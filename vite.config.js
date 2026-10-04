import { defineConfig } from 'vite';
import { accessControlPlugin } from './server/accessControl.js';

export default defineConfig({
  server: {
    host: '0.0.0.0', // Permite que cualquier dispositivo en la red local se conecte
    port: 3000,
    open: false
  },
  plugins: [
    accessControlPlugin()
  ]
});
