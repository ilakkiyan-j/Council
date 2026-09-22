import { Router, Request, Response } from 'express';
import { PERSONAS } from '../core/personas.js';
import { noxTools } from '../connectors/nox/tools.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    service: 'Council — Multi-Persona AI Hub',
    personas: Object.keys(PERSONAS),
    activeToolsCount: noxTools.length,
    timestamp: new Date().toISOString(),
  });
});
