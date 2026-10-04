import http from 'http';
import { accessControlPlugin, getLocalIpAddress } from './server/accessControl.js';

console.log('Testing access control...');
console.log('Detected Local IP:', getLocalIpAddress());

// Mock connect server to test the middleware directly
const plugin = accessControlPlugin();
let middleware = null;

const fakeServer = {
  config: { server: { port: 3000 } },
  middlewares: {
    use(fn) {
      middleware = fn;
    }
  }
};

plugin.configureServer(fakeServer);

if (!middleware) {
  console.error('FAIL: Middleware was not registered');
  process.exit(1);
}

// Helper to run simulated request through middleware
function simulateReq(options, body = null) {
  return new Promise((resolve) => {
    const req = {
      url: options.url,
      method: options.method || 'GET',
      headers: {
        host: 'localhost:3000',
        ...(options.headers || {})
      },
      socket: {
        remoteAddress: options.remoteAddress || '127.0.0.1'
      },
      on(event, handler) {
        if (event === 'data' && body) {
          handler(Buffer.from(JSON.stringify(body)));
        }
        if (event === 'end') {
          handler();
        }
      }
    };

    let statusCode = 200;
    let headers = {};
    let responseData = '';

    const res = {
      setHeader(k, v) { headers[k] = v; },
      end(data) {
        responseData = data;
        resolve({
          statusCode: res.statusCode || statusCode,
          headers,
          data: responseData ? JSON.parse(responseData) : null
        });
      }
    };

    middleware(req, res, () => {
      resolve({ statusCode: 404, data: null });
    });
  });
}

async function runTests() {
  console.log('\n--- 1. Test Localhost Status ---');
  let res = await simulateReq({
    url: '/api/access/status',
    remoteAddress: '127.0.0.1'
  });
  console.log('Localhost status:', res.data);
  if (!res.data.isLocalhost || !res.data.isAllowed) throw new Error('Localhost should be admin and allowed');

  console.log('\n--- 2. Test External Device Status (Unauthorized) ---');
  const extToken = 'dev_test_phone_123';
  res = await simulateReq({
    url: '/api/access/status',
    remoteAddress: '192.168.1.55',
    headers: { 'x-device-token': extToken }
  });
  console.log('External device status:', res.data);
  if (res.data.isAllowed || res.data.isLocalhost) throw new Error('External device should NOT be allowed initially');

  console.log('\n--- 3. Test External Device Request Access ---');
  res = await simulateReq({
    url: '/api/access/request',
    method: 'POST',
    remoteAddress: '192.168.1.55',
    headers: { 'content-type': 'application/json' }
  }, { token: extToken, name: 'iPhone de Prueba' });
  console.log('Request access res:', res.data);
  if (res.data.status !== 'pending') throw new Error('Request status should be pending');

  console.log('\n--- 4. Test Admin Data ---');
  res = await simulateReq({
    url: '/api/access/admin/data',
    remoteAddress: '127.0.0.1'
  });
  console.log('Admin data pending count:', res.data.pendingRequests.length);
  const foundReq = res.data.pendingRequests.find(r => r.token === extToken);
  if (!foundReq) throw new Error('Pending request should be present in admin data');

  console.log('\n--- 5. Test Admin Approve ---');
  res = await simulateReq({
    url: '/api/access/admin/approve',
    method: 'POST',
    remoteAddress: '127.0.0.1',
    headers: { 'content-type': 'application/json' }
  }, { token: extToken, name: 'iPhone de Prueba' });
  console.log('Admin approve res:', res.data);
  if (!res.data.success) throw new Error('Approve failed');

  console.log('\n--- 6. Test External Device Status After Approval ---');
  res = await simulateReq({
    url: '/api/access/status',
    remoteAddress: '192.168.1.55',
    headers: { 'x-device-token': extToken }
  });
  console.log('External status after approval:', res.data);
  if (!res.data.isAllowed) throw new Error('Device should now be allowed');

  console.log('\n--- 7. Test Admin Revoke ---');
  res = await simulateReq({
    url: '/api/access/admin/revoke',
    method: 'POST',
    remoteAddress: '127.0.0.1',
    headers: { 'content-type': 'application/json' }
  }, { token: extToken });
  console.log('Admin revoke res:', res.data);
  if (!res.data.success) throw new Error('Revoke failed');

  res = await simulateReq({
    url: '/api/access/status',
    remoteAddress: '192.168.1.55',
    headers: { 'x-device-token': extToken }
  });
  console.log('External status after revoke:', res.data);
  if (res.data.isAllowed) throw new Error('Device should NO LONGER be allowed after revoke');

  console.log('\n--- 8. Test PIN Setup and Verification ---');
  await simulateReq({
    url: '/api/access/admin/set-pin',
    method: 'POST',
    remoteAddress: '127.0.0.1',
    headers: { 'content-type': 'application/json' }
  }, { pin: '4321' });

  // Wrong PIN
  res = await simulateReq({
    url: '/api/access/pin',
    method: 'POST',
    remoteAddress: '192.168.1.55',
    headers: { 'content-type': 'application/json' }
  }, { token: 'dev_pin_test', name: 'Dispositivo PIN', pin: '9999' });
  console.log('Wrong PIN result (expect 401):', res.statusCode);
  if (res.statusCode !== 401) throw new Error('Wrong PIN should return 401');

  // Correct PIN
  res = await simulateReq({
    url: '/api/access/pin',
    method: 'POST',
    remoteAddress: '192.168.1.55',
    headers: { 'content-type': 'application/json' }
  }, { token: 'dev_pin_test', name: 'Dispositivo PIN', pin: '4321' });
  console.log('Correct PIN result:', res.data);
  if (!res.data.success) throw new Error('Correct PIN should succeed');

  // Clean up PIN for clean initial state
  await simulateReq({
    url: '/api/access/admin/set-pin',
    method: 'POST',
    remoteAddress: '127.0.0.1',
    headers: { 'content-type': 'application/json' }
  }, { pin: '' });

  // Remove test device from allowedDevices
  await simulateReq({
    url: '/api/access/admin/revoke',
    method: 'POST',
    remoteAddress: '127.0.0.1',
    headers: { 'content-type': 'application/json' }
  }, { token: 'dev_pin_test' });

  console.log('\n--- 9. Test Manual IP Authorization (Option 1) ---');
  const manualIp = '192.168.1.150';
  res = await simulateReq({
    url: '/api/access/admin/add-ip',
    method: 'POST',
    remoteAddress: '127.0.0.1',
    headers: { 'content-type': 'application/json' }
  }, { ip: manualIp, name: 'Celular IP Estática' });
  console.log('Add IP response:', res.data);
  if (!res.data.success || res.data.device.ip !== manualIp) throw new Error('add-ip failed');

  // Verify that an unknown device connecting from this IP is automatically allowed!
  res = await simulateReq({
    url: '/api/access/status',
    remoteAddress: manualIp,
    headers: { 'x-device-token': 'dev_brand_new_device_from_that_ip' }
  });
  console.log('Status of device connecting from authorized IP:', res.data);
  if (!res.data.isAllowed || res.data.deviceName !== 'Celular IP Estática') {
    throw new Error('Device with authorized IP must be immediately allowed!');
  }

  // Clean up
  await simulateReq({
    url: '/api/access/admin/revoke',
    method: 'POST',
    remoteAddress: '127.0.0.1',
    headers: { 'content-type': 'application/json' }
  }, { ip: manualIp });

  console.log('\n🎉 ALL 9 ACCESS CONTROL TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
