import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { BotService } from '../services/botService.js';
import { requireAuth } from '../middleware/auth.js';
import { seedUserDefaultBots } from '../services/seedService.js';

export const botsRouter = Router();
const botService = new BotService(prisma);

/**
 * GET /api/v1/bots
 * List all custom Bots belonging to the authenticated user.
 * Automatically seeds default user bots on first load if the user has none.
 */
botsRouter.get('/bots', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    // Auto-seed on first visit if user has no bots
    await seedUserDefaultBots(prisma, userId);

    const bots = await botService.listBots(userId);
    return res.status(200).json({ success: true, data: bots });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err?.message || 'Failed to list bots' } });
  }
});

/**
 * POST /api/v1/bots
 * Create a new custom Bot with persona, instructions, model, and integrations
 */
botsRouter.post('/bots', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, slug, description, avatar, color, role, isDefault, persona, instruction, modelConfig, integrations } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Bot name is required.' } });
    }

    const bot = await botService.createBot(
      userId,
      {
        name,
        slug,
        description,
        avatar,
        color,
        role,
        isDefault,
        persona,
        instruction,
        modelConfig,
        integrations,
      },
      req.ip
    );

    return res.status(201).json({ success: true, data: bot });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to create bot' } });
  }
});

/**
 * GET /api/v1/bots/:id
 * Retrieve details for a specific Bot
 */
botsRouter.get('/bots/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const botId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bot = await botService.getBot(userId, botId);
    return res.status(200).json({ success: true, data: bot });
  } catch (err: any) {
    return res.status(404).json({ success: false, error: { message: err?.message || 'Bot not found' } });
  }
});

/**
 * PATCH /api/v1/bots/:id
 * Update Bot configuration
 */
botsRouter.patch('/bots/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const botId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await botService.updateBot(userId, botId, req.body, req.ip);
    return res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to update bot' } });
  }
});

/**
 * DELETE /api/v1/bots/:id
 * Delete a user's custom Bot
 */
botsRouter.delete('/bots/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const botId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await botService.deleteBot(userId, botId, req.ip);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to delete bot' } });
  }
});

/**
 * POST /api/v1/bots/:id/duplicate
 * Clones an existing Bot
 */
botsRouter.post('/bots/:id/duplicate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const botId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const duplicated = await botService.duplicateBot(userId, botId, req.ip);
    return res.status(201).json({ success: true, data: duplicated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to duplicate bot' } });
  }
});
