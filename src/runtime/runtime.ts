import { PrismaClient } from '@prisma/client';
import { BotService } from '../services/botService.js';
import { ConversationService } from '../services/conversationService.js';
import { MemoryService } from '../services/memoryService.js';
import { ModelRouter } from '../providers/router.js';
import { buildBotContext } from './contextBuilder.js';
import { resolveToolsForBot } from '../registry/tools.js';
import { MessageTurn, ModelChunk } from '../providers/types.js';
import { logAudit } from '../security/audit.js';

export interface RuntimeChatRequest {
  userId: string;
  botIdOrSlug: string;
  message: string;
  conversationId?: string;
  userContext?: any;
  authToken?: string;
  ipAddress?: string;
}

export interface RuntimeChatResult {
  botId: string;
  botName: string;
  conversationId: string;
  reply: string;
  executedActions: Array<{ toolName: string; params: any; result: any }>;
  modelUsed: string;
  latencyMs: number;
}

export class BotRuntime {
  constructor(
    private prisma: PrismaClient,
    private botService: BotService,
    private conversationService: ConversationService,
    private memoryService: MemoryService
  ) {}

  async execute(request: RuntimeChatRequest): Promise<RuntimeChatResult> {
    const { userId, botIdOrSlug, message, userContext, authToken, ipAddress } = request;

    // 1. Resolve Bot
    const bot = await this.botService.getBot(userId, botIdOrSlug);

    // 2. Resolve or create conversation
    let conversationId = request.conversationId;
    if (!conversationId) {
      const conv = await this.conversationService.createConversation(userId, bot.id);
      conversationId = conv.id;
    } else {
      // Auto-create conversation with client's requested ID (e.g. from Nox sessions) if not found
      const existing = await this.prisma.conversation.findFirst({
        where: { id: conversationId, userId },
      });
      if (!existing) {
        await this.prisma.conversation.create({
          data: {
            id: conversationId,
            userId,
            botId: bot.id,
            title: `Chat with ${bot.name}`,
          },
        });
      }
    }

    // 3. Save User Message
    await this.conversationService.addMessage(conversationId, 'user', message);

    // 4. Retrieve recent message history (last 20 turns)
    const rawHistory = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const turns: MessageTurn[] = rawHistory.reverse().map((m) => ({
      role: m.role as any,
      content: m.content,
    }));

    // 5. Build dynamic system context
    const systemPrompt = await buildBotContext({
      bot,
      userId,
      userContext,
      memoryService: this.memoryService,
    });

    // 6. Resolve permitted tools
    const tools = resolveToolsForBot(bot.integrations as any);

    // 7. Route and execute through ModelRouter
    const router = ModelRouter.getInstance();
    const modelResponse = await router.executeForBot(this.prisma, userId, bot.id, {
      systemPrompt,
      history: turns,
      tools,
      authToken,
    });

    // 8. Save Assistant Message & Tool telemetry
    await this.conversationService.addMessage(conversationId, 'assistant', modelResponse.reply, {
      toolCalls: modelResponse.executedActions.map((a) => ({ name: a.toolName, params: a.params })),
      toolResults: modelResponse.executedActions.map((a) => a.result),
      latencyMs: modelResponse.latencyMs,
      metadata: { modelUsed: modelResponse.modelUsed },
    });

    // 9. Extract & save facts non-blockingly
    this.memoryService.extractAndSaveFacts(userId, bot.id, message, modelResponse.reply);

    // 10. Audit log tool executions
    if (modelResponse.executedActions.length > 0) {
      for (const action of modelResponse.executedActions) {
        await logAudit(this.prisma, {
          userId,
          action: 'TOOL_EXECUTED',
          entityType: 'TOOL',
          entityId: action.toolName,
          details: { botId: bot.id, tool: action.toolName },
          ipAddress,
        });
      }
    }

    return {
      botId: bot.id,
      botName: bot.name,
      conversationId,
      reply: modelResponse.reply,
      executedActions: modelResponse.executedActions,
      modelUsed: modelResponse.modelUsed,
      latencyMs: modelResponse.latencyMs || 0,
    };
  }

  async *stream(request: RuntimeChatRequest): AsyncIterable<ModelChunk> {
    const { userId, botIdOrSlug, message, userContext, authToken } = request;

    const bot = await this.botService.getBot(userId, botIdOrSlug);

    let conversationId = request.conversationId;
    if (!conversationId) {
      const conv = await this.conversationService.createConversation(userId, bot.id);
      conversationId = conv.id;
    } else {
      const existing = await this.prisma.conversation.findFirst({
        where: { id: conversationId, userId },
      });
      if (!existing) {
        await this.prisma.conversation.create({
          data: {
            id: conversationId,
            userId,
            botId: bot.id,
            title: `Chat with ${bot.name}`,
          },
        });
      }
    }

    await this.conversationService.addMessage(conversationId, 'user', message);

    const rawHistory = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const turns: MessageTurn[] = rawHistory.reverse().map((m) => ({
      role: m.role as any,
      content: m.content,
    }));

    const systemPrompt = await buildBotContext({
      bot,
      userId,
      userContext,
      memoryService: this.memoryService,
    });

    const tools = resolveToolsForBot(bot.integrations as any);
    const router = ModelRouter.getInstance();

    let fullReply = '';
    let actions: Array<{ toolName: string; params: any; result: any }> = [];

    for await (const chunk of router.streamForBot(this.prisma, userId, bot.id, {
      systemPrompt,
      history: turns,
      tools,
      authToken,
    })) {
      if (chunk.type === 'delta' && chunk.text) {
        fullReply += chunk.text;
      }
      if (chunk.type === 'done' && chunk.executedActions) {
        actions = chunk.executedActions;
      }
      yield chunk;
    }

    // Persist completed reply
    if (fullReply) {
      await this.conversationService.addMessage(conversationId, 'assistant', fullReply, {
        toolCalls: actions.map((a) => ({ name: a.toolName, params: a.params })),
        toolResults: actions.map((a) => a.result),
      });
      this.memoryService.extractAndSaveFacts(userId, bot.id, message, fullReply);
    }
  }
}
