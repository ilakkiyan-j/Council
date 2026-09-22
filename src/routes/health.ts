import { Router, Request, Response } from 'express';
import { REGISTERED_TOOLS } from '../registry/tools.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    service: 'Council V2 — Custom AI Bot Platform',
    version: '2.0.0',
    activeToolsCount: REGISTERED_TOOLS.length,
    database: 'PostgreSQL',
    timestamp: new Date().toISOString(),
  });
});
