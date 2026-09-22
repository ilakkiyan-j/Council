import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { ModelRouter } from '../providers/router.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureSystemApplications } from '../services/seedService.js';

export const applicationsRouter = Router();

/**
 * GET /api/v1/applications
 * List all registered applications and their available tools
 */
applicationsRouter.get('/applications', requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureSystemApplications(prisma);
    const apps = await prisma.application.findMany({
      include: {
        tools: true,
      },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json({ success: true, data: apps });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err?.message || 'Failed to list applications' } });
  }
});

/**
 * GET /api/v1/providers
 * List all supported AI providers (Gemini, OpenAI, Groq, Anthropic, Ollama)
 */
applicationsRouter.get('/providers', requireAuth, async (_req: Request, res: Response) => {
  const router = ModelRouter.getInstance();
  const providers = router.listSupportedProviders();
  return res.status(200).json({ success: true, data: providers });
});
