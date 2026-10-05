import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { VoiceService } from '../services/voiceService.js';
import { BotService } from '../services/botService.js';
import { ConversationService } from '../services/conversationService.js';
import { MemoryService } from '../services/memoryService.js';
import { BotRuntime } from '../runtime/runtime.js';
import { requireAuth } from '../middleware/auth.js';
import { sanitizeTextForSpeech } from '../runtime/voiceSanitizer.js';
import { buildSpokenBotContext } from '../runtime/spokenPromptEngine.js';
import { ModelRouter } from '../providers/router.js';
import { resolveToolsForBot } from '../registry/tools.js';
import { MessageTurn } from '../providers/types.js';
import { seedUserDefaultBots } from '../services/seedService.js';

export const voiceRouter = Router();

const voiceService = new VoiceService(prisma);
const botService = new BotService(prisma);
const conversationService = new ConversationService(prisma);
const memoryService = new MemoryService(prisma);
const runtime = new BotRuntime(prisma, botService, conversationService, memoryService);

/**
 * GET /api/v1/voice/preferences
 * Returns the authenticated user's current voice configuration
 */
voiceRouter.get('/voice/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const preferences = await voiceService.getUserPreferences(userId);
    return res.status(200).json({ success: true, data: preferences });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err?.message || 'Failed to fetch voice preferences' } });
  }
});

/**
 * PATCH /api/v1/voice/preferences
 * Updates voice model, pitch, and rate for the user
 */
voiceRouter.patch('/voice/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { voiceModel, pitch, rate, isCloneEnabled } = req.body;
    const updated = await voiceService.updatePreferences(userId, { voiceModel, pitch, rate, isCloneEnabled });
    return res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err?.message || 'Failed to update voice preferences' } });
  }
});

/**
 * GET /api/v1/voice/catalog
 * Returns the catalog of available voices with multi-tenant clone isolation
 */
voiceRouter.get('/voice/catalog', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const catalog = await voiceService.getVoiceCatalog(userId);
    return res.status(200).json({ success: true, data: catalog });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err?.message || 'Failed to fetch voice catalog' } });
  }
});

/**
 * POST /api/v1/voice/test
 * Synthesizes a live test sample phrase using user's chosen pitch and rate
 */
voiceRouter.post('/voice/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { text, voiceModel, pitch, rate } = req.body;

    const sampleText = text || "Hi Ilakkiyan! This is my real-time voice response in NOX.";
    let audioUrl: string | null = null;
    let durationEstimateSec = 2;

    try {
      const result = await voiceService.synthesize({
        text: sampleText,
        userId,
        voiceModel,
        pitch,
        rate,
      });
      audioUrl = result.audioUrl;
      durationEstimateSec = result.durationEstimateSec;
    } catch (ttsErr: any) {
      console.warn('[Voice Test] Subprocess TTS fallback:', ttsErr?.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        audioUrl,
        durationEstimateSec,
        sampleText,
      },
    });
  } catch (err: any) {
    console.error('Voice test synthesis error:', err);
    return res.status(200).json({
      success: true,
      data: {
        audioUrl: null,
        durationEstimateSec: 2,
        sampleText: req.body?.text || 'Ready',
      },
    });
  }
});

/**
 * POST /api/v1/voice/call-turn
 * Real-Time Voice Calling Turn Endpoint:
 * Executes bot reasoning with natural spoken persona directives,
 * sanitizes speech, synthesizes speech audio, and returns both audio and text.
 */
voiceRouter.post('/voice/call-turn', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { botId, persona, message, conversationId, userContext } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Message text is required.' } });
    }

    // Auto-seed default bots for user if needed
    await seedUserDefaultBots(prisma, userId);

    const targetBotSlug = botId || persona || 'sofi';
    const bot = await botService.getBot(userId, targetBotSlug);

    // 1. Resolve / create conversation safely
    let convId = conversationId;
    if (!convId) {
      const conv = await conversationService.createConversation(userId, bot.id, `Voice Call with ${bot.name}`);
      convId = conv.id;
    } else {
      const existing = await prisma.conversation.findFirst({
        where: { id: convId, userId },
      });
      if (!existing) {
        await prisma.conversation.create({
          data: {
            id: convId,
            userId,
            botId: bot.id,
            title: `Voice Call with ${bot.name}`,
          },
        });
      }
    }

    // 2. Save user message
    await conversationService.addMessage(convId, 'user', message);

    // 3. Retrieve history
    const rawHistory = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const turns: MessageTurn[] = rawHistory.reverse().map((m) => ({
      role: m.role as any,
      content: m.content,
    }));

    // 4. Build Spoken Persona Context (No markdown, concise conversational cadence)
    const spokenSystemPrompt = await buildSpokenBotContext({
      bot,
      userId,
      userContext,
      memoryService,
      isSpokenMode: true,
    });

    // 5. Execute LLM Reasoning
    const tools = resolveToolsForBot(bot.integrations as any, {
      userId,
      botId: bot.id,
      botService,
    });

    const modelRouter = ModelRouter.getInstance();
    const modelResponse = await modelRouter.executeForBot(prisma, userId, bot.id, {
      systemPrompt: spokenSystemPrompt,
      history: turns,
      tools,
      authToken: req.headers.authorization,
    });

    // 6. Clean and sanitize response text for spoken audio
    const sanitizedSpeech = sanitizeTextForSpeech(modelResponse.reply);

    // 7. Synthesize Speech Audio with User's Voice Preference (with fallback)
    let audioUrl = '';
    try {
      const audioResult = await voiceService.synthesize({
        text: sanitizedSpeech,
        userId,
      });
      audioUrl = audioResult.audioUrl;
    } catch (ttsErr) {
      console.warn('Voice call TTS synthesis warning (falling back to browser speech synthesis):', ttsErr);
    }

    // 8. Save Assistant Message
    await conversationService.addMessage(convId, 'assistant', modelResponse.reply, {
      metadata: { isSpokenCall: true, audioUrl },
      latencyMs: modelResponse.latencyMs,
    });

    return res.status(200).json({
      success: true,
      data: {
        botId: bot.id,
        botName: bot.name,
        role: bot.role,
        userMessage: message,
        replyText: modelResponse.reply,
        spokenText: sanitizedSpeech,
        audioUrl,
        conversationId: convId,
        latencyMs: modelResponse.latencyMs,
      },
    });
  } catch (err: any) {
    console.error('Voice Call Turn Error:', err);
    return res.status(500).json({ success: false, error: { message: err?.message || 'Voice call processing failed' } });
  }
});
