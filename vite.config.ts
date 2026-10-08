import { resolve } from 'node:path';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

// Локально отдаёт /api/<имя> из api/<имя>.ts так же, как функции Vercel (экспорт GET).
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      // Функциям нужны серверные переменные (DATABASE_URL) из .env.local, как на Vercel.
      Object.assign(process.env, loadEnv(server.config.mode, root, ''));
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([a-z0-9-]+)(?:\?|$)/);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(resolve(root, 'api', `${match[1]}.ts`));
          if (typeof mod.GET !== 'function') return next();
          const response: Response = await mod.GET(new Request(`http://localhost${req.url}`));
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  root: resolve(root, 'app'),
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true },
  plugins: [localApi()],
  test: { root, include: ['**/*.test.ts'], exclude: ['node_modules/**'] },
});
