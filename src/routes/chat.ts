import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { BotService } from '../services/botService.js';
import { ConversationService } from '../services/conversationService.js';
import { MemoryService } from '../services/memoryService.js';
import { BotRuntime } from '../runtime/runtime.js';
import { requireAuth } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';
import { seedUserDefaultBots } from '../services/seedService.js';

export const chatRouter = Router();

const botService = new BotService(prisma);
const conversationService = new ConversationService(prisma);
const memoryService = new MemoryService(prisma);
const runtime = new BotRuntime(prisma, botService, conversationService, memoryService);

/**
 * POST /api/v1/chat
 * Primary chat endpoint for any custom AI Bot.
 * Backward compatible: Accepts either `botId` or legacy `persona` (resolves by slug).
 */
chatRouter.post('/chat', requireAuth, chatRateLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { botId, persona, message, conversationId, sessionId, userContext } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Message string is required.' } });
    }

    // Auto-seed user default bots on first chat if needed
    await seedUserDefaultBots(prisma, userId);

    const targetBot = botId || persona || 'sofi';
    const convId = conversationId || sessionId;
    const authToken = req.headers.authorization;

    const result = await runtime.execute({
      userId,
      botIdOrSlug: targetBot,
      message,
      conversationId: convId,
      userContext,
      authToken,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      data: {
        botId: result.botId,
        botName: result.botName,
        persona: targetBot, // backward compatibility
        reply: result.reply,
        conversationId: result.conversationId,
        sessionId: result.conversationId, // backward compatibility
        executedActions: result.executedActions,
        modelUsed: result.modelUsed,
        latencyMs: result.latencyMs,
      },
    });
  } catch (err: any) {
    console.error('Council Chat Runtime Error:', err);
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to process chat message.' },
    });
  }
});

/**
 * POST /api/v1/chat/stream
 * Server-Sent Events (SSE) streaming endpoint for live token delivery.
 */
chatRouter.post('/chat/stream', requireAuth, chatRateLimiter, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { botId, persona, message, conversationId, sessionId, userContext } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'Message is required.' } });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const targetBot = botId || persona || 'sofi';
  const convId = conversationId || sessionId;
  const authToken = req.headers.authorization;

  res.write(`data: ${JSON.stringify({ type: 'start', botId: targetBot })}\n\n`);

  try {
    await seedUserDefaultBots(prisma, userId);

    for await (const chunk of runtime.stream({
      userId,
      botIdOrSlug: targetBot,
      message,
      conversationId: convId,
      userContext,
      authToken,
      ipAddress: req.ip,
    })) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err?.message || 'Streaming failed.' })}\n\n`);
    res.end();
  }
});
