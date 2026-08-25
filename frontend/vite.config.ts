import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy en dev hacia la API (Fastify, mismo host/puerto que ya corre en
// desarrollo — ver server/config/env.ts, PORT=3000 por defecto). Con el
// proxy el navegador solo habla con el origen de Vite, así que la
// cookie httpOnly de sesión funciona sin tocar CORS en el backend.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
