import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../access_control.json');

// Obtener la dirección IP local de la máquina en la red Wi-Fi / Ethernet
export function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorar direcciones internas (127.0.0.1) y solo buscar IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Cargar o inicializar la base de datos de control de acceso
function loadData() {
  const defaultData = {
    mode: 'restricted', // 'restricted' (solo autorizados) o 'open' (cualquiera en red)
    pin: '',            // PIN opcional de auto-acceso
    allowedDevices: [], // [{ token, name, ip, addedAt, lastSeen }]
    pendingRequests: [] // [{ id, token, name, ip, requestedAt, userAgent }]
  };

  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return { ...defaultData, ...JSON.parse(content) };
    }
  } catch (err) {
    console.error('[AccessControl] Error leyendo access_control.json:', err);
  }
  return defaultData;
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AccessControl] Error guardando access_control.json:', err);
  }
}

// Detectar IP del cliente
export function getClientIp(req) {
  const xForwarded = req.headers['x-forwarded-for'];
  const raw = (typeof xForwarded === 'string' ? xForwarded.split(',')[0] : null) || req.socket?.remoteAddress || '';
  let ip = raw.trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

// Saber si la petición viene de localhost (Administrador seguro en la misma máquina)
export function isLocalhost(req) {
  const ip = getClientIp(req);
  return ip === '127.0.0.1' || ip === 'localhost' || ip === '::1';
}

// Helper para parsear JSON body en Connect/Vite
function parseJsonBody(req) {
  return new Promise((resolve) => {
    if (req.body) return resolve(req.body);
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-token');
  res.end(JSON.stringify(payload));
}

// Plugin para Vite
export function accessControlPlugin() {
  return {
    name: 'vite-plugin-access-control',
    configureServer(server) {
      const port = server.config.server.port || 3000;
      const localIp = getLocalIpAddress();
      const networkUrl = `http://${localIp}:${port}`;

      console.log('\n======================================================');
      console.log('🛡️  SISTEMA DE CONTROL DE ACCESO PARA RED LOCAL');
      console.log(`🌐 Acceso local para esta PC: http://localhost:${port}`);
      console.log(`📱 Enlace para dispositivos en tu red: ${networkUrl}`);
      console.log('======================================================\n');

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        const clientIp = getClientIp(req);
        const isAdmin = isLocalhost(req);

        // Rutas API de Control de Acceso
        if (url.startsWith('/api/access/')) {
          const data = loadData();

          // 1. Estado del dispositivo actual
          if (url === '/api/access/status' && req.method === 'GET') {
            const queryToken = new URL(req.url, `http://${req.headers.host}`).searchParams.get('token');
            const token = req.headers['x-device-token'] || queryToken || '';

            // Si es localhost siempre está permitido
            if (isAdmin) {
              return sendJson(res, 200, {
                isAllowed: true,
                isLocalhost: true,
                isPending: false,
                mode: data.mode,
                pinRequired: Boolean(data.pin),
                clientIp,
                localIp,
                networkUrl
              });
            }

            // Si el modo es abierto, cualquiera en la red puede entrar
            if (data.mode === 'open') {
              return sendJson(res, 200, {
                isAllowed: true,
                isLocalhost: false,
                isPending: false,
                mode: 'open',
                pinRequired: Boolean(data.pin),
                clientIp,
                localIp,
                networkUrl
              });
            }

            // Modo restringido: validar por token O por IP autorizada
            const matchedDevice = data.allowedDevices.find(d => 
              (token && d.token === token) || (clientIp && d.ip === clientIp)
            );
            if (matchedDevice) {
              // Si fue registrado por IP antes de que el dispositivo tuviera token, asociar el token real ahora
              if (token && (!matchedDevice.token || matchedDevice.token.startsWith('ip_'))) {
                matchedDevice.token = token;
              }
              matchedDevice.lastSeen = new Date().toISOString();
              matchedDevice.ip = clientIp;
              saveData(data);

              return sendJson(res, 200, {
                isAllowed: true,
                isLocalhost: false,
                isPending: false,
                deviceName: matchedDevice.name,
                mode: data.mode,
                pinRequired: Boolean(data.pin),
                clientIp,
                localIp,
                networkUrl
              });
            }

            // No está permitido aún, verificar si tiene solicitud pendiente
            const isPending = data.pendingRequests.some(r => r.token === token);

            return sendJson(res, 200, {
              isAllowed: false,
              isLocalhost: false,
              isPending,
              mode: data.mode,
              pinRequired: Boolean(data.pin),
              clientIp,
              localIp,
              networkUrl
            });
          }

          // 2. Solicitar acceso
          if (url === '/api/access/request' && req.method === 'POST') {
            const body = await parseJsonBody(req);
            const { token, name } = body;

            if (!token) {
              return sendJson(res, 400, { error: 'Token requerido' });
            }

            // Revisar si ya está permitido
            const alreadyAllowed = data.allowedDevices.some(d => d.token === token);
            if (alreadyAllowed) {
              return sendJson(res, 200, { status: 'already_allowed' });
            }

            // Agregar o actualizar solicitud pendiente
            const existingIndex = data.pendingRequests.findIndex(r => r.token === token);
            const reqInfo = {
              id: 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
              token,
              name: (name || 'Dispositivo sin nombre').trim().slice(0, 50),
              ip: clientIp,
              requestedAt: new Date().toISOString(),
              userAgent: req.headers['user-agent'] || 'Desconocido'
            };

            if (existingIndex >= 0) {
              data.pendingRequests[existingIndex] = reqInfo;
            } else {
              data.pendingRequests.push(reqInfo);
            }

            saveData(data);
            return sendJson(res, 200, { status: 'pending', request: reqInfo });
          }

          // 3. Verificación rápida por PIN
          if (url === '/api/access/pin' && req.method === 'POST') {
            const body = await parseJsonBody(req);
            const { token, name, pin } = body;

            if (!data.pin) {
              return sendJson(res, 400, { error: 'No hay PIN configurado en el servidor' });
            }

            if (pin && String(pin).trim() === String(data.pin).trim()) {
              // Aprobado automáticamente
              data.allowedDevices.push({
                token,
                name: (name || 'Dispositivo verificado por PIN').trim(),
                ip: clientIp,
                addedAt: new Date().toISOString(),
                lastSeen: new Date().toISOString()
              });

              // Remover de pendientes si existía
              data.pendingRequests = data.pendingRequests.filter(r => r.token !== token);
              saveData(data);

              return sendJson(res, 200, { success: true });
            } else {
              return sendJson(res, 401, { error: 'PIN incorrecto' });
            }
          }

          // === RUTAS EXCLUSIVAS DE ADMINISTRADOR ===
          if (url.startsWith('/api/access/admin/')) {
            if (!isAdmin) {
              return sendJson(res, 403, { error: 'Acceso no autorizado: Solo accesible desde el anfitrión (localhost)' });
            }

            // Obtener datos del panel de administrador
            if (url === '/api/access/admin/data' && req.method === 'GET') {
              return sendJson(res, 200, {
                mode: data.mode,
                pin: data.pin || '',
                allowedDevices: data.allowedDevices,
                pendingRequests: data.pendingRequests,
                clientIp,
                localIp,
                networkUrl
              });
            }

            // Cambiar modo (restringido / abierto)
            if (url === '/api/access/admin/toggle-mode' && req.method === 'POST') {
              const body = await parseJsonBody(req);
              data.mode = body.mode === 'open' ? 'open' : 'restricted';
              saveData(data);
              return sendJson(res, 200, { success: true, mode: data.mode });
            }

            // Cambiar o quitar PIN
            if (url === '/api/access/admin/set-pin' && req.method === 'POST') {
              const body = await parseJsonBody(req);
              data.pin = String(body.pin || '').trim();
              saveData(data);
              return sendJson(res, 200, { success: true, pin: data.pin });
            }

            // Aprobar solicitud
            if (url === '/api/access/admin/approve' && req.method === 'POST') {
              const body = await parseJsonBody(req);
              const { token, name, requestId } = body;

              const reqItem = data.pendingRequests.find(r => r.token === token || r.id === requestId);
              const deviceToken = token || reqItem?.token;
              const deviceName = name || reqItem?.name || 'Dispositivo Autorizado';

              if (!deviceToken) {
                return sendJson(res, 400, { error: 'Token no especificado' });
              }

              // Si ya estaba en la lista, actualizarlo
              const existingIdx = data.allowedDevices.findIndex(d => d.token === deviceToken);
              const newEntry = {
                token: deviceToken,
                name: deviceName,
                ip: reqItem?.ip || clientIp,
                addedAt: new Date().toISOString(),
                lastSeen: new Date().toISOString()
              };

              if (existingIdx >= 0) {
                data.allowedDevices[existingIdx] = newEntry;
              } else {
                data.allowedDevices.push(newEntry);
              }

              // Quitar de pendientes
              data.pendingRequests = data.pendingRequests.filter(r => r.token !== deviceToken && r.id !== requestId);
              saveData(data);

              return sendJson(res, 200, { success: true, device: newEntry });
            }

            // Rechazar solicitud
            if (url === '/api/access/admin/reject' && req.method === 'POST') {
              const body = await parseJsonBody(req);
              const { token, requestId } = body;

              data.pendingRequests = data.pendingRequests.filter(r => r.token !== token && r.id !== requestId);
              saveData(data);
              return sendJson(res, 200, { success: true });
            }

            // Revocar dispositivo permitido
            if (url === '/api/access/admin/revoke' && req.method === 'POST') {
              const body = await parseJsonBody(req);
              const { token, ip } = body;

              data.allowedDevices = data.allowedDevices.filter(d => 
                d.token !== token && (!ip || d.ip !== ip)
              );
              saveData(data);
              return sendJson(res, 200, { success: true });
            }

            // Agregar dispositivo directamente por IP (Opción 1)
            if (url === '/api/access/admin/add-ip' && req.method === 'POST') {
              const body = await parseJsonBody(req);
              let { ip: targetIp, name } = body;

              targetIp = (targetIp || '').trim();
              if (!targetIp) {
                return sendJson(res, 400, { error: 'Debes ingresar una dirección IP válida' });
              }

              const cleanName = (name || 'Dispositivo ' + targetIp).trim().slice(0, 40);
              const existingIdx = data.allowedDevices.findIndex(d => d.ip === targetIp);
              const entry = {
                token: 'ip_' + targetIp,
                name: cleanName,
                ip: targetIp,
                addedAt: new Date().toISOString(),
                lastSeen: null
              };

              if (existingIdx >= 0) {
                data.allowedDevices[existingIdx].name = cleanName;
              } else {
                data.allowedDevices.push(entry);
              }

              // Quitar de pendientes si existía una solicitud de esa IP
              data.pendingRequests = data.pendingRequests.filter(r => r.ip !== targetIp);
              saveData(data);

              return sendJson(res, 200, { success: true, device: entry });
            }
          }
        }

        next();
      });
    }
  };
}
