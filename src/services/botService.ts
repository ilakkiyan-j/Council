import { PrismaClient } from '@prisma/client';
import { logAudit } from '../security/audit.js';

export interface CreateBotInput {
  name: string;
  slug?: string;
  description?: string;
  avatar?: string;
  color?: string;
  role?: string;
  isDefault?: boolean;
  persona?: {
    personality?: string[];
    communicationStyle?: string;
    traits?: { creativity?: number; strictness?: number; humor?: number };
    role?: string;
    goals?: string[];
    behaviorRules?: string[];
  };
  instruction?: {
    systemPrompt: string;
    contextGuidelines?: string;
    safetyRules?: string;
  };
  modelConfig?: {
    provider: string;
    model: string;
    credentialId?: string | null;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    customEndpoint?: string | null;
  };
  integrations?: Array<{
    applicationId: string;
    permissions?: Record<string, string>;
  }>;
}

export interface UpdateBotInput extends Partial<CreateBotInput> {
  status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
}

export class BotService {
  constructor(private prisma: PrismaClient) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async listBots(userId: string) {
    return this.prisma.bot.findMany({
      where: { userId },
      include: {
        persona: true,
        instruction: true,
        modelConfig: {
          include: {
            credential: {
              select: {
                id: true,
                provider: true,
                label: true,
                keyFingerprint: true,
                status: true,
              },
            },
          },
        },
        integrations: {
          include: {
            application: true,
          },
        },
        _count: {
          select: {
            conversations: true,
            memories: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getBot(userId: string, botIdOrSlug: string) {
    const bot = await this.prisma.bot.findFirst({
      where: {
        userId,
        OR: [{ id: botIdOrSlug }, { slug: botIdOrSlug }],
      },
      include: {
        persona: true,
        instruction: true,
        modelConfig: {
          include: {
            credential: {
              select: {
                id: true,
                provider: true,
                label: true,
                keyFingerprint: true,
                status: true,
                lastValidatedAt: true,
              },
            },
          },
        },
        integrations: {
          include: {
            application: {
              include: {
                tools: true,
              },
            },
          },
        },
        _count: {
          select: {
            conversations: true,
            memories: true,
          },
        },
      },
    });

    if (!bot) {
      throw new Error(`Bot "${botIdOrSlug}" not found or unauthorized.`);
    }

    return bot;
  }

  async createBot(userId: string, input: CreateBotInput, ipAddress?: string) {
    let slug = input.slug ? this.slugify(input.slug) : this.slugify(input.name);
    if (!slug) slug = `bot-${Date.now()}`;

    // Ensure unique slug per user
    const existing = await this.prisma.bot.findUnique({
      where: { userId_slug: { userId, slug } },
    });
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const bot = await this.prisma.bot.create({
      data: {
        userId,
        name: input.name,
        slug,
        description: input.description || '',
        avatar: input.avatar || '🤖',
        color: input.color || 'indigo',
        role: input.role || 'Custom Assistant',
        isDefault: input.isDefault || false,
        persona: input.persona
          ? {
              create: {
                personality: input.persona.personality || [],
                communicationStyle: input.persona.communicationStyle || 'concise',
                traits: input.persona.traits || { creativity: 0.6, strictness: 0.5, humor: 0.3 },
                role: input.persona.role || input.role,
                goals: input.persona.goals || [],
                behaviorRules: input.persona.behaviorRules || [],
              },
            }
          : undefined,
        instruction: {
          create: {
            systemPrompt: input.instruction?.systemPrompt || `You are ${input.name}, a helpful AI assistant.`,
            contextGuidelines: input.instruction?.contextGuidelines || '',
            safetyRules: input.instruction?.safetyRules || '',
          },
        },
        modelConfig: {
          create: {
            provider: input.modelConfig?.provider || 'gemini',
            model: input.modelConfig?.model || 'gemini-2.5-flash',
            credentialId: input.modelConfig?.credentialId || null,
            temperature: input.modelConfig?.temperature ?? 0.7,
            maxTokens: input.modelConfig?.maxTokens ?? 2048,
            topP: input.modelConfig?.topP ?? 0.95,
            customEndpoint: input.modelConfig?.customEndpoint || null,
          },
        },
      },
    });

    if (input.integrations && input.integrations.length > 0) {
      for (const integration of input.integrations) {
        await this.prisma.botIntegration.create({
          data: {
            botId: bot.id,
            applicationId: integration.applicationId,
            permissions: integration.permissions ?? {},
          },
        });
      }
    }

    await logAudit(this.prisma, {
      userId,
      action: 'BOT_CREATED',
      entityType: 'BOT',
      entityId: bot.id,
      details: { name: bot.name, slug: bot.slug, role: bot.role },
      ipAddress,
    });

    return this.getBot(userId, bot.id);
  }

  async updateBot(userId: string, botIdOrSlug: string, input: UpdateBotInput, ipAddress?: string) {
    const existing = await this.prisma.bot.findFirst({
      where: {
        userId,
        OR: [{ id: botIdOrSlug }, { slug: botIdOrSlug }],
      },
    });

    if (!existing) {
      throw new Error(`Bot with ID "${botIdOrSlug}" not found or unauthorized.`);
    }

    const botId = existing.id;

    const updated = await this.prisma.bot.update({
      where: { id: botId },
      data: {
        name: input.name,
        description: input.description,
        avatar: input.avatar,
        color: input.color,
        role: input.role,
        status: input.status,
        isDefault: input.isDefault,
      },
    });

    if (input.persona) {
      await this.prisma.botPersona.upsert({
        where: { botId },
        update: {
          personality: input.persona.personality as any,
          communicationStyle: input.persona.communicationStyle,
          traits: input.persona.traits as any,
          role: input.persona.role,
          goals: input.persona.goals as any,
          behaviorRules: input.persona.behaviorRules as any,
        },
        create: {
          botId,
          personality: input.persona.personality as any,
          communicationStyle: input.persona.communicationStyle,
          traits: input.persona.traits as any,
          role: input.persona.role,
          goals: input.persona.goals as any,
          behaviorRules: input.persona.behaviorRules as any,
        },
      });
    }

    if (input.instruction) {
      await this.prisma.botInstruction.upsert({
        where: { botId },
        update: {
          systemPrompt: input.instruction.systemPrompt,
          contextGuidelines: input.instruction.contextGuidelines,
          safetyRules: input.instruction.safetyRules,
        },
        create: {
          botId,
          systemPrompt: input.instruction.systemPrompt,
          contextGuidelines: input.instruction.contextGuidelines,
          safetyRules: input.instruction.safetyRules,
        },
      });
    }

    if (input.modelConfig) {
      await this.prisma.modelConfiguration.upsert({
        where: { botId },
        update: {
          provider: input.modelConfig.provider,
          model: input.modelConfig.model,
          credentialId: input.modelConfig.credentialId,
          temperature: input.modelConfig.temperature,
          maxTokens: input.modelConfig.maxTokens,
          topP: input.modelConfig.topP,
          customEndpoint: input.modelConfig.customEndpoint,
        },
        create: {
          botId,
          provider: input.modelConfig.provider,
          model: input.modelConfig.model,
          credentialId: input.modelConfig.credentialId,
          temperature: input.modelConfig.temperature ?? 0.7,
          maxTokens: input.modelConfig.maxTokens ?? 2048,
          topP: input.modelConfig.topP ?? 0.95,
          customEndpoint: input.modelConfig.customEndpoint,
        },
      });
    }

    if (input.integrations) {
      // Refresh integrations
      await this.prisma.botIntegration.deleteMany({ where: { botId } });
      for (const integration of input.integrations) {
        await this.prisma.botIntegration.create({
          data: {
            botId,
            applicationId: integration.applicationId,
            permissions: integration.permissions ?? {},
          },
        });
      }
    }

    await logAudit(this.prisma, {
      userId,
      action: 'BOT_UPDATED',
      entityType: 'BOT',
      entityId: botId,
      details: { name: updated.name },
      ipAddress,
    });

    return this.getBot(userId, botId);
  }

  async deleteBot(userId: string, botIdOrSlug: string, ipAddress?: string) {
    const existing = await this.prisma.bot.findFirst({
      where: {
        userId,
        OR: [{ id: botIdOrSlug }, { slug: botIdOrSlug }],
      },
    });

    if (!existing) {
      throw new Error(`Bot "${botIdOrSlug}" not found or unauthorized.`);
    }

    const botId = existing.id;

    await this.prisma.bot.delete({
      where: { id: botId },
    });

    await logAudit(this.prisma, {
      userId,
      action: 'BOT_DELETED',
      entityType: 'BOT',
      entityId: botId,
      details: { name: existing.name },
      ipAddress,
    });

    return { success: true, message: `Bot "${existing.name}" deleted successfully.` };
  }

  async duplicateBot(userId: string, botId: string, ipAddress?: string) {
    const original = await this.getBot(userId, botId);
    return this.createBot(
      userId,
      {
        name: `${original.name} (Copy)`,
        description: original.description || '',
        avatar: original.avatar || '🤖',
        color: original.color || 'indigo',
        role: original.role,
        persona: original.persona
          ? {
              personality: (original.persona.personality as string[]) || [],
              communicationStyle: original.persona.communicationStyle || undefined,
              traits: (original.persona.traits as any) || undefined,
              role: original.persona.role || undefined,
              goals: (original.persona.goals as string[]) || [],
              behaviorRules: (original.persona.behaviorRules as string[]) || [],
            }
          : undefined,
        instruction: original.instruction
          ? {
              systemPrompt: original.instruction.systemPrompt,
              contextGuidelines: original.instruction.contextGuidelines || undefined,
              safetyRules: original.instruction.safetyRules || undefined,
            }
          : undefined,
        modelConfig: original.modelConfig
          ? {
              provider: original.modelConfig.provider,
              model: original.modelConfig.model,
              credentialId: original.modelConfig.credentialId,
              temperature: original.modelConfig.temperature,
              maxTokens: original.modelConfig.maxTokens,
            }
          : undefined,
        integrations: original.integrations.map((i) => ({
          applicationId: i.applicationId,
          permissions: (i.permissions as Record<string, string>) || {},
        })),
      },
      ipAddress
    );
  }
}
