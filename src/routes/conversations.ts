import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { ConversationService } from '../services/conversationService.js';
import { requireAuth } from '../middleware/auth.js';

export const conversationsRouter = Router();
const convService = new ConversationService(prisma);

/**
 * GET /api/v1/conversations
 * List conversations for the authenticated user, optionally filtered by botId.
 */
conversationsRouter.get('/conversations', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const botId = req.query.botId as string | undefined;
    const list = await convService.listConversations(userId, botId);
    return res.status(200).json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err?.message || 'Failed to list conversations' } });
  }
});

/**
 * GET /api/v1/conversations/:id
 * Retrieve message history for a specific conversation.
 */
conversationsRouter.get('/conversations/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const convId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conversation = await convService.getConversation(userId, convId);
    return res.status(200).json({ success: true, data: conversation });
  } catch (err: any) {
    return res.status(404).json({ success: false, error: { message: err?.message || 'Conversation not found' } });
  }
});

/**
 * POST /api/v1/conversations
 * Create a new conversation with a bot.
 */
conversationsRouter.post('/conversations', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { botId, title } = req.body;
    if (!botId) {
      return res.status(400).json({ success: false, error: { message: 'botId is required' } });
    }
    const conv = await convService.createConversation(userId, botId, title);
    return res.status(201).json({ success: true, data: conv });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to create conversation' } });
  }
});

/**
 * DELETE /api/v1/conversations/:id
 * Delete a conversation.
 */
conversationsRouter.delete('/conversations/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const convId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await convService.deleteConversation(userId, convId);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to delete conversation' } });
  }
});

/**
 * Legacy compatibility alias for Nox: GET /api/v1/sessions
 */
conversationsRouter.get('/sessions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const list = await convService.listConversations(userId);
    const sessions = list.map((c) => ({
      sessionId: c.id,
      personaId: c.bot.slug,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
      lastMessagePreview: c.title,
    }));
    return res.status(200).json({ success: true, data: sessions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err?.message || 'Failed to list sessions' } });
  }
});

/**
 * Legacy compatibility alias for Nox: GET /api/v1/sessions/:id
 */
conversationsRouter.get('/sessions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conv = await prisma.conversation.findFirst({
      where: { id, userId },
      include: {
        bot: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conv) {
      return res.status(200).json({
        success: true,
        data: {
          sessionId: id,
          personaId: 'sofi',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        sessionId: conv.id,
        personaId: conv.bot?.slug || 'sofi',
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        messages: conv.messages.map((m) => ({
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
          toolResults: m.toolResults,
          timestamp: m.createdAt.toISOString(),
        })),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err?.message || 'Failed to get session' } });
  }
});

/**
 * Legacy compatibility alias for Nox: DELETE /api/v1/sessions/:id
 */
conversationsRouter.delete('/sessions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await convService.deleteConversation(userId, id);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to delete session' } });
  }
});

