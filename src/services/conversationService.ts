import { PrismaClient } from '@prisma/client';

export class ConversationService {
  constructor(private prisma: PrismaClient) {}

  async listConversations(userId: string, botId?: string) {
    return this.prisma.conversation.findMany({
      where: {
        userId,
        ...(botId ? { botId } : {}),
        archivedAt: null,
      },
      include: {
        bot: {
          select: { id: true, name: true, slug: true, avatar: true, color: true },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        bot: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conv) {
      throw new Error(`Conversation "${conversationId}" not found or unauthorized.`);
    }

    return conv;
  }

  async createConversation(userId: string, botId: string, title?: string) {
    const bot = await this.prisma.bot.findFirst({
      where: { id: botId, userId },
    });

    if (!bot) {
      throw new Error(`Bot "${botId}" not found or unauthorized.`);
    }

    return this.prisma.conversation.create({
      data: {
        userId,
        botId,
        title: title || `Chat with ${bot.name}`,
      },
      include: {
        bot: true,
      },
    });
  }

  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    extra?: {
      metadata?: any;
      toolCalls?: any;
      toolResults?: any;
      tokensUsed?: number;
      latencyMs?: number;
    }
  ) {
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        metadata: extra?.metadata ?? undefined,
        toolCalls: extra?.toolCalls ?? undefined,
        toolResults: extra?.toolResults ?? undefined,
        tokensUsed: extra?.tokensUsed ?? 0,
        latencyMs: extra?.latencyMs ?? 0,
      },
    });

    // Touch conversation updatedAt
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return msg;
  }

  async clearConversation(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conv) {
      throw new Error(`Conversation "${conversationId}" not found or unauthorized.`);
    }

    await this.prisma.message.deleteMany({
      where: { conversationId },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { summary: null, updatedAt: new Date() },
    });

    return { success: true, message: 'Conversation history cleared.' };
  }

  async deleteConversation(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conv) {
      throw new Error(`Conversation "${conversationId}" not found or unauthorized.`);
    }

    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { success: true, message: 'Conversation deleted.' };
  }
}
