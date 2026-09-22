import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { healthRouter } from './routes/health.js';
import { botsRouter } from './routes/bots.js';
import { credentialsRouter } from './routes/credentials.js';
import { conversationsRouter } from './routes/conversations.js';
import { chatRouter } from './routes/chat.js';
import { applicationsRouter } from './routes/applications.js';
import { memoryRouter } from './routes/memory.js';
import { deliberateRouter } from './routes/deliberate.js';
import { authenticateUser } from './middleware/auth.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  // Locate public directory (works in both src/ and dist/ runtime)
  const publicDir = fs.existsSync(path.resolve(process.cwd(), 'src', 'public'))
    ? path.resolve(process.cwd(), 'src', 'public')
    : path.resolve(process.cwd(), 'public');

  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Root endpoint: serve Dashboard if browser/HTML requested, otherwise JSON status
  app.get('/', (req, res) => {
    const acceptsHtml = req.accepts('html');
    const indexFile = path.join(publicDir, 'index.html');
    if (acceptsHtml && fs.existsSync(indexFile)) {
      return res.sendFile(indexFile);
    }
    return res.status(200).json({ status: 'ok', service: 'Council V2 — Custom AI Bot Platform' });
  });

  app.get('/health', (_req, res) => {
    return res.status(200).json({ status: 'ok', service: 'Council V2 — Custom AI Bot Platform' });
  });

  app.get('/dashboard', (_req, res) => {
    const indexFile = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexFile)) {
      return res.sendFile(indexFile);
    }
    return res.status(200).send('Council Dashboard');
  });

  // Global authentication resolver for API routes
  app.use('/api/v1', authenticateUser);

  // Mount API modules
  app.use('/api/v1', healthRouter);
  app.use('/api/v1', botsRouter);
  app.use('/api/v1', credentialsRouter);
  app.use('/api/v1', conversationsRouter);
  app.use('/api/v1', chatRouter);
  app.use('/api/v1', applicationsRouter);
  app.use('/api/v1', memoryRouter);
  app.use('/api/v1', deliberateRouter);

  return app;
}
