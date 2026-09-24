import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiPlugin(): Plugin {
  return {
    name: 'api-server',
    async configureServer(server) {
      const express = (await import('express')).default;
      const app = express();
      const { apiRouter } = await import('./server/api.ts');
      app.use('/api', apiRouter);
      server.middlewares.use(app);
    },
  };
}

function htmlPlugin(): Plugin {
  return {
    name: 'html-transform',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.server) {
          // In dev mode, replace production bundles with dev entrypoint
          return html
            .replace('./assets/app-v3.js', '/src/main.tsx')
            .replace('<link rel="stylesheet" crossorigin href="./assets/app-v3.css">', '');
        }
        return html;
      },
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [htmlPlugin(), react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/app-v3.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'assets/app-v3.css';
            }
            return 'assets/[name][extname]';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
