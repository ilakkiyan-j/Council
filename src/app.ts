import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { chatRouter } from './routes/chat.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  // Fallback root & health endpoints for deployment cloud platforms (Render, Railway, Fly, etc.)
  app.get('/', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'Council — Multi-Persona AI Hub' });
  });
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'Council — Multi-Persona AI Hub' });
  });

  app.use('/api/v1', healthRouter);
  app.use('/api/v1', chatRouter);

  return app;
}
