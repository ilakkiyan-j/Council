import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { chatRouter } from './routes/chat.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/v1', healthRouter);
  app.use('/api/v1', chatRouter);

  return app;
}
