import { PrismaClient } from '@prisma/client';
import { ModelProvider, ModelRequest, ModelResponse, ModelChunk } from './types.js';
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
   * Resolves the authenticated user's credential for a bot, decrypts it in-memory,
   * and executes the model request without any plaintext leakage or global fallback.
   */
  public async executeForBot(
    prisma: PrismaClient,
    userId: string,
    botId: string,
    partialRequest: Omit<ModelRequest, 'apiKey' | 'model' | 'customEndpoint'>
  ): Promise<ModelResponse> {
    const { adapter, resolvedRequest } = await this.prepareRequest(prisma, userId, botId, partialRequest);
    return adapter.generate(resolvedRequest);
  }

  /**
   * Resolves credential and streams response for a bot.
   */
  public async *streamForBot(
    prisma: PrismaClient,
    userId: string,
    botId: string,
    partialRequest: Omit<ModelRequest, 'apiKey' | 'model' | 'customEndpoint'>
  ): AsyncIterable<ModelChunk> {
    const { adapter, resolvedRequest } = await this.prepareRequest(prisma, userId, botId, partialRequest);
    yield* adapter.stream(resolvedRequest);
  }

  /**
   * Internal helper to authorize credential ownership, decrypt server-side immediately before call,
   * and build the final executable ModelRequest.
   */
  private async prepareRequest(
    prisma: PrismaClient,
    userId: string,
    botId: string,
    partialRequest: Omit<ModelRequest, 'apiKey' | 'model' | 'customEndpoint'>
  ): Promise<{ adapter: ModelProvider; resolvedRequest: ModelRequest }> {
    const modelConfig = await prisma.modelConfiguration.findUnique({
      where: { botId },
      include: { credential: true },
    });

    if (!modelConfig) {
      throw new Error(`Model configuration not found for bot "${botId}".`);
    }

    const providerId = modelConfig.provider.toLowerCase();
    const adapter = this.getAdapter(providerId);

    let decryptedKey: string | undefined = undefined;

    if (!adapter.isLocal) {
      const cred = modelConfig.credential;
      if (!cred || cred.userId !== userId || cred.status !== 'ACTIVE') {
        throw new Error(
          `Your ${adapter.name} credential is unavailable. Reconnect your provider in Settings -> AI Providers to continue.`
        );
      }

      try {
        decryptedKey = decryptCredential(cred.encryptedSecret, cred.iv, cred.authTag);
      } catch (err: any) {
        throw new Error(`Failed to decrypt ${adapter.name} credential: ${err.message}`);
      }
    }

    const resolvedRequest: ModelRequest = {
      ...partialRequest,
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens,
      apiKey: decryptedKey,
      customEndpoint: modelConfig.customEndpoint || undefined,
    };

    return { adapter, resolvedRequest };
  }
}
