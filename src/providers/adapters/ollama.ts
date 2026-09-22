import { ModelProvider, ModelRequest, ModelResponse, ModelChunk } from '../types.js';

export class OllamaAdapter implements ModelProvider {
  readonly providerId = 'ollama';
  readonly name = 'Ollama (Local)';
  readonly isLocal = true;

  async validateCredential(_apiKey: string, customEndpoint?: string): Promise<{ valid: boolean; error?: string }> {
    const baseUrl = customEndpoint || 'http://localhost:11434';
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        return { valid: true };
      }
      return { valid: false, error: `Ollama endpoint responded with HTTP ${res.status}` };
    } catch (err: any) {
      return {
        valid: false,
        error: `Could not connect to Ollama at ${baseUrl}. Ensure Ollama is running locally.`,
      };
    }
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    const baseUrl = request.customEndpoint || 'http://localhost:11434';
    const model = request.model || 'llama3.2';

    const messages = [
      { role: 'system', content: request.systemPrompt },
      ...request.history.map((h) => ({
        role: h.role,
        content: h.content,
      })),
    ];

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/chat`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 2048,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed with HTTP ${res.status}`);
    }

    const data: any = await res.json();
    const reply = data?.message?.content || '';

    return {
      reply,
      executedActions: [],
      modelUsed: model,
      latencyMs: Date.now() - startTime,
    };
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelChunk> {
    yield { type: 'start' };
    try {
      const response = await this.generate(request);
      const words = response.reply.split(' ');
      for (let i = 0; i < words.length; i += 4) {
        const chunk = words.slice(i, i + 4).join(' ') + (i + 4 < words.length ? ' ' : '');
        yield { type: 'delta', text: chunk };
        await new Promise((r) => setTimeout(r, 16));
      }
      yield {
        type: 'done',
        executedActions: response.executedActions,
      };
    } catch (err: any) {
      yield { type: 'error', error: err.message };
    }
  }
}
