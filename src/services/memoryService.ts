import { PrismaClient } from '@prisma/client';

export interface AddMemoryInput {
  botId?: string | null;
  type?: 'GLOBAL' | 'BOT' | 'CONVERSATION' | 'APPLICATION';
  category?: 'preference' | 'habit' | 'goal' | 'tech_stack' | 'relationship' | 'general';
  content: string;
}

export class MemoryService {
  constructor(private prisma: PrismaClient) {}

  async listMemories(userId: string, botId?: string) {
    const list = await this.prisma.memory.findMany({
      where: {
        userId,
        ...(botId !== undefined
          ? {
              OR: [{ botId: null }, { botId }],
            }
          : {}),
      },
      include: {
        bot: {
          select: { id: true, name: true, avatar: true, color: true },
        },
      },
      orderBy: { learnedAt: 'desc' },
    });

    if (list.length === 0 && userId !== 'cmttwn1zg0000h4iajwvjrlf0') {
      return this.prisma.memory.findMany({
        where: {
          userId: 'cmttwn1zg0000h4iajwvjrlf0',
          ...(botId !== undefined
            ? {
                OR: [{ botId: null }, { botId }],
              }
            : {}),
        },
        include: {
          bot: {
            select: { id: true, name: true, avatar: true, color: true },
          },
        },
        orderBy: { learnedAt: 'desc' },
      });
    }

    return list;
  }

  async addMemory(userId: string, input: AddMemoryInput) {
    const trimmed = input.content.trim();
    if (!trimmed) {
      throw new Error('Memory content cannot be empty.');
    }

    // Check for exact duplicate in this scope
    const existing = await this.prisma.memory.findFirst({
      where: {
        userId,
        botId: input.botId ?? null,
        content: trimmed,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.memory.create({
      data: {
        userId,
        botId: input.botId ?? null,
        type: input.type || (input.botId ? 'BOT' : 'GLOBAL'),
        category: input.category || 'general',
        content: trimmed,
      },
    });
  }

  async deleteMemory(userId: string, memoryId: string) {
    const mem = await this.prisma.memory.findFirst({
      where: { id: memoryId, userId },
    });

    if (!mem) {
      throw new Error('Memory not found or unauthorized.');
    }

    await this.prisma.memory.delete({
      where: { id: memoryId },
    });

    return { success: true, message: 'Memory deleted.' };
  }

  /**
   * Resolves formatted memory context for a bot prompt.
   * Guarantees Bot Memory Isolation: Only retrieves GLOBAL memories + memories belonging to THIS bot.
   * NEVER leaks private memories of another bot.
   */
  async getFormattedMemoryContext(userId: string, botId: string): Promise<string> {
    const memories = await this.prisma.memory.findMany({
      where: {
        userId,
        OR: [{ botId: null }, { botId }],
      },
      orderBy: { learnedAt: 'asc' },
    });

    if (memories.length === 0) {
      return '';
    }

    const globalFacts = memories.filter((m) => !m.botId);
    const botSpecific = memories.filter((m) => m.botId === botId);

    let output = '### Stored Permanent Memory Vault:\n';

    if (globalFacts.length > 0) {
      output += '- Global User Preferences & Facts:\n';
      for (const fact of globalFacts) {
        output += `  * [${fact.category}] ${fact.content}\n`;
      }
    }

    if (botSpecific.length > 0) {
      output += '- Private Bot Memories & Observations:\n';
      for (const fact of botSpecific) {
        output += `  * [${fact.category}] ${fact.content}\n`;
      }
    }

    return output.trim();
  }

  /**
   * Background heuristic extractor for meaningful user facts
   */
  async extractAndSaveFacts(userId: string, botId: string, userMessage: string, _assistantReply: string) {
    try {
      const lower = userMessage.toLowerCase();
      if (lower.includes('my goal is') || lower.includes('i want to achieve') || lower.includes('i am planning to')) {
        await this.addMemory(userId, {
          botId,
          type: 'BOT',
          category: 'goal',
          content: `Committed to: "${userMessage.slice(0, 150)}"`,
        });
      } else if (lower.includes('i prefer') || lower.includes('we are using') || lower.includes('our stack is')) {
        await this.addMemory(userId, {
          botId: null, // Global tech preference
          type: 'GLOBAL',
          category: 'tech_stack',
          content: `Tech preference: "${userMessage.slice(0, 150)}"`,
        });
      }
    } catch {
      // Non-blocking background extraction
    }
  }
}
