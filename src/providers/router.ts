import { PrismaClient } from '@prisma/client';
import { ModelProvider, ModelRequest, ModelResponse, ModelChunk, FallbackConfigItem } from './types.js';
import { GeminiAdapter } from './adapters/gemini.js';
import { GroqAdapter } from './adapters/groq.js';
import { OpenAIAdapter } from './adapters/openai.js';
import { OllamaAdapter } from './adapters/ollama.js';
import { decryptCredential } from '../security/encryption.js';

export class ModelRouter {
  private static instance: ModelRouter;
  private adapters: Map<string, ModelProvider> = new Map();

  private constructor() {
    this.registerAdapter(new GeminiAdapter());
    this.registerAdapter(new GroqAdapter());
    this.registerAdapter(new OpenAIAdapter());
    this.registerAdapter(new OllamaAdapter());
  }

  public static getInstance(): ModelRouter {
    if (!ModelRouter.instance) {
      ModelRouter.instance = new ModelRouter();
    }
    return ModelRouter.instance;
  }

  public registerAdapter(adapter: ModelProvider): void {
    this.adapters.set(adapter.providerId.toLowerCase(), adapter);
  }

  public getAdapter(providerId: string): ModelProvider {
    const adapter = this.adapters.get(providerId.toLowerCase());
    if (!adapter) {
      throw new Error(`Unsupported AI model provider: "${providerId}".`);
    }
    return adapter;
  }

  public listSupportedProviders(): Array<{ id: string; name: string; isLocal: boolean }> {
    return Array.from(this.adapters.values()).map((a) => ({
      id: a.providerId,
      name: a.name,
      isLocal: a.isLocal,
    }));
  }

  /**
   * Executes model generation for a bot with multi-provider fallback failover.
   * If the primary provider fails (rate limit, downtime), it transparently fails over to the next configured fallback.
   */
  public async executeForBot(
    prisma: PrismaClient,
    userId: string,
    botId: string,
    partialRequest: Omit<ModelRequest, 'apiKey' | 'model' | 'customEndpoint'>
  ): Promise<ModelResponse> {
    const candidates = await this.resolveProviderCandidates(prisma, userId, botId);
    const errors: Array<{ provider: string; error: string }> = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const isFallback = i > 0;

      try {
        const { adapter, resolvedRequest } = await this.prepareRequestForCandidate(
          prisma,
          userId,
          botId,
          candidate,
          partialRequest
        );

        const response = await adapter.generate(resolvedRequest);
        return {
          ...response,
          modelUsed: isFallback
            ? `${resolvedRequest.model} (Failover #${i} via ${candidate.provider})`
            : response.modelUsed,
        };
      } catch (err: any) {
        console.warn(`[ModelRouter Failover] Provider "${candidate.provider}" failed for bot "${botId}":`, err.message);
        errors.push({ provider: candidate.provider, error: err.message });
      }
    }

    throw new Error(
      `All AI providers in fallback pipeline failed. Attempted:\n${errors
        .map((e) => `• ${e.provider.toUpperCase()}: ${e.error}`)
        .join('\n')}`
    );
  }

  /**
   * Resolves credential and streams response for a bot with multi-provider fallback.
   */
  public async *streamForBot(
    prisma: PrismaClient,
    userId: string,
    botId: string,
    partialRequest: Omit<ModelRequest, 'apiKey' | 'model' | 'customEndpoint'>
  ): AsyncIterable<ModelChunk> {
    const candidates = await this.resolveProviderCandidates(prisma, userId, botId);
    let success = false;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      try {
        const { adapter, resolvedRequest } = await this.prepareRequestForCandidate(
          prisma,
          userId,
          botId,
          candidate,
          partialRequest
        );

        yield* adapter.stream(resolvedRequest);
        success = true;
        break;
      } catch (err: any) {
        console.warn(`[ModelRouter Stream Failover] Provider "${candidate.provider}" failed:`, err.message);
      }
    }

    if (!success) {
      yield {
        type: 'error',
        error: 'All AI model providers in fallback pipeline failed to stream.',
      };
    }
  }

  /**
   * Resolves the ordered list of provider candidates from bot configuration & fallback pipeline
   */
  private async resolveProviderCandidates(
    prisma: PrismaClient,
    userId: string,
    botId: string
  ): Promise<Array<{ provider: string; model?: string }>> {
    const modelConfig = await prisma.modelConfiguration.findUnique({
      where: { botId },
    });

    const primaryProvider = modelConfig?.provider?.toLowerCase() || 'gemini';
    const primaryModel = modelConfig?.model || (primaryProvider === 'gemini' ? 'gemini-2.5-flash' : undefined);

    const candidates: Array<{ provider: string; model?: string }> = [
      { provider: primaryProvider, model: primaryModel },
    ];

    // Extract custom fallback pipeline if configured in customEndpoint or DB
    if (modelConfig?.customEndpoint) {
      try {
        const parsed = JSON.parse(modelConfig.customEndpoint);
        if (Array.isArray(parsed?.fallbackPipeline)) {
          for (const item of parsed.fallbackPipeline) {
            if (item?.provider && item.enabled !== false && item.provider.toLowerCase() !== primaryProvider) {
              candidates.push({
                provider: item.provider.toLowerCase(),
                model: item.model || undefined,
              });
            }
          }
        }
      } catch {
        // Not a JSON payload, standard custom endpoint
      }
    }

    // Default fallback cascade if no custom pipeline specified
    const defaultCascade = ['gemini', 'groq', 'openai', 'ollama'];
    for (const p of defaultCascade) {
      if (!candidates.some((c) => c.provider === p)) {
        candidates.push({ provider: p });
      }
    }

    return candidates;
  }

  /**
   * Resolves decrypted credentials for a specific provider candidate
   */
  private async prepareRequestForCandidate(
    prisma: PrismaClient,
    userId: string,
    botId: string,
    candidate: { provider: string; model?: string },
    partialRequest: Omit<ModelRequest, 'apiKey' | 'model' | 'customEndpoint'>
  ): Promise<{ adapter: ModelProvider; resolvedRequest: ModelRequest }> {
    const modelConfig = await prisma.modelConfiguration.findUnique({
      where: { botId },
      include: { credential: true },
    });

    const providerId = candidate.provider.toLowerCase();
    const adapter = this.getAdapter(providerId);
    let targetModel = candidate.model || modelConfig?.model || (providerId === 'gemini' ? 'gemini-2.5-flash' : 'default');

    let decryptedKey: string | undefined = undefined;

    if (!adapter.isLocal) {
      let cred = modelConfig?.provider === providerId ? modelConfig.credential : null;

      // 1. User active key for this specific provider
      if (!cred || cred.userId !== userId || cred.status !== 'ACTIVE') {
        cred = await prisma.providerCredential.findFirst({
          where: {
            userId,
            provider: providerId,
            status: 'ACTIVE',
          },
          orderBy: { updatedAt: 'desc' },
        });
      }

      // 2. Global workspace key for this specific provider
      if (!cred || cred.status !== 'ACTIVE') {
        cred = await prisma.providerCredential.findFirst({
          where: {
            provider: providerId,
            status: 'ACTIVE',
          },
          orderBy: { updatedAt: 'desc' },
        });
      }

      // 3. Fallback to process.env keys
      if (!cred || cred.status !== 'ACTIVE') {
        const envKey =
          (providerId === 'gemini' && process.env.GEMINI_API_KEY) ||
          (providerId === 'openai' && process.env.OPENAI_API_KEY) ||
          (providerId === 'groq' && process.env.GROQ_API_KEY) ||
          (providerId === 'anthropic' && process.env.ANTHROPIC_API_KEY);

        if (envKey) {
          decryptedKey = envKey;
        } else {
          throw new Error(`No active API key configured for provider "${providerId.toUpperCase()}".`);
        }
      } else {
        decryptedKey = decryptCredential(cred.encryptedSecret, cred.iv, cred.authTag);
      }
    }

    const resolvedRequest: ModelRequest = {
      ...partialRequest,
      model: targetModel,
      temperature: modelConfig?.temperature ?? 0.7,
      maxTokens: modelConfig?.maxTokens ?? 4096,
      apiKey: decryptedKey,
    };

    return { adapter, resolvedRequest };
  }
}
