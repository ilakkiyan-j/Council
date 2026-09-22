import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { MemoryService } from '../services/memoryService.js';
import { requireAuth } from '../middleware/auth.js';

export const memoryRouter = Router();
const memoryService = new MemoryService(prisma);

/**
 * GET /api/v1/memory
 * List all permanent memories for the user, optionally filtered by botId.
 */
memoryRouter.get('/memory', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const botId = req.query.botId as string | undefined;
    const memories = await memoryService.listMemories(userId, botId);

    // Format backward-compatible profile object for legacy Nox calls
    const facts = memories.map((m) => ({
      id: m.id,
      category: m.category,
      fact: m.content,
      learnedAt: m.learnedAt.toISOString(),
      sourcePersona: m.bot?.name,
      botId: m.botId,
    }));

    return res.status(200).json({
      success: true,
      data: {
        userId,
        facts,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err?.message || 'Failed to fetch memory' } });
  }
});

/**
 * POST /api/v1/memory
 * Add a fact to the permanent memory vault.
 */
memoryRouter.post('/memory', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fact, category = 'general', botId, type } = req.body;

    if (!fact || typeof fact !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Fact string is required.' } });
    }

    const created = await memoryService.addMemory(userId, {
      botId,
      type,
      category,
      content: fact,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to add memory' } });
  }
});

/**
 * DELETE /api/v1/memory/:id
 * Delete a memory.
 */
memoryRouter.delete('/memory/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const memoryId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await memoryService.deleteMemory(userId, memoryId);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to delete memory' } });
  }
});
