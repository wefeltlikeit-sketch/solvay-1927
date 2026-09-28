import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Mounts the same /api handler the production server uses, so `npm run dev`
 * is a single process. The handler lives in server/api.mjs.
 */
function solvayApi(): Plugin {
  return {
    name: 'solvay-api',
    async configureServer(server) {
      const { handleApi } = await import('./server/api.mjs');
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          await handleApi(req, res);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), solvayApi()],
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1200 },
  test: { environment: 'node' },
} as never);
