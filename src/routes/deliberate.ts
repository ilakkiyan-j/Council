import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { BotService } from '../services/botService.js';
import { ConversationService } from '../services/conversationService.js';
import { MemoryService } from '../services/memoryService.js';
import { BotRuntime } from '../runtime/runtime.js';
import { requireAuth } from '../middleware/auth.js';
import { seedUserDefaultBots } from '../services/seedService.js';

export const deliberateRouter = Router();

const botService = new BotService(prisma);
const conversationService = new ConversationService(prisma);
const memoryService = new MemoryService(prisma);
const runtime = new BotRuntime(prisma, botService, conversationService, memoryService);

/**
 * Universal Dynamic Deliberation Endpoint
 * Accepts any array of botIds (or defaults to the user's active bots).
 * Supports both /council/deliberate and /council/debate.
 */
async function handleDeliberation(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { topic, botIds, userContext } = req.body;

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Debate topic is required.' } });
    }

    await seedUserDefaultBots(prisma, userId);

    // Resolve bots to participate
    let participants: any[] = [];
    if (Array.isArray(botIds) && botIds.length >= 2) {
      for (const id of botIds) {
        try {
          const b = await botService.getBot(userId, id);
          participants.push(b);
        } catch {
          // Skip invalid bot
        }
      }
    }

    if (participants.length < 2) {
      // Fetch user's active bots
      const allBots = await botService.listBots(userId);
      participants = allBots.slice(0, 3);
    }

    if (participants.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No bots available for deliberation.' } });
    }

    const authToken = req.headers.authorization;
    const deliberationHistory: Array<{
      botId: string;
      name: string;
      role: string;
      opinion?: string;
      synthesis?: string;
    }> = [];

    let runningDebateContext = `The user presents the following topic for Council deliberation: "${topic}"\n\n`;

    for (let i = 0; i < participants.length; i++) {
      const currentBot = participants[i];
      const isFinal = i === participants.length - 1 && participants.length > 1;

      let promptForBot = '';
      if (isFinal) {
        promptForBot = `${runningDebateContext}\nYou are the final synthesizer. Review the positions above and give your balanced, actionable synthesis and recommendation for the user. Keep it under 180 words.`;
      } else {
        promptForBot = `${runningDebateContext}\nGive your direct evaluation, critique, and perspective on this topic based on your unique role and expertise. Keep it under 150 words.`;
      }

      const result = await runtime.execute({
        userId,
        botIdOrSlug: currentBot.id,
        message: promptForBot,
        userContext,
        authToken,
        ipAddress: req.ip,
      });

      runningDebateContext += `- ${currentBot.name} (${currentBot.role}): "${result.reply}"\n\n`;

      if (isFinal) {
        deliberationHistory.push({
          botId: currentBot.id,
          name: currentBot.name,
          role: currentBot.role,
          synthesis: result.reply,
        });
      } else {
        deliberationHistory.push({
          botId: currentBot.id,
          name: currentBot.name,
          role: currentBot.role,
          opinion: result.reply,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        topic,
        deliberation: deliberationHistory,
      },
    });
  } catch (err: any) {
    console.error('Council Deliberation Error:', err);
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Deliberation failed.' },
    });
  }
}

deliberateRouter.post('/council/deliberate', requireAuth, handleDeliberation);
deliberateRouter.post('/council/debate', requireAuth, handleDeliberation);
