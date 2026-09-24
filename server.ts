import express from 'express';
import path from 'node:path';
import 'dotenv/config';
import { apiRouter } from './server/api.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// API routes
app.use('/api', apiRouter);

async function startServer() {
  if (!isProd) {
    // Mount Vite middlewares in dev mode as specified in the framework guidelines
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend build in production
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));

    // Fallback for SPA routing
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[WanScript & LTX Video Studio] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
