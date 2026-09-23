import express from 'express';
import path from 'node:path';
import 'dotenv/config';
import { apiRouter } from './server/api.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// API routes
app.use('/api', apiRouter);

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WanScript Studio] Server running on http://0.0.0.0:${PORT}`);
});
