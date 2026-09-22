import OpenAI from 'openai';
import { ModelProvider, ModelRequest, ModelResponse, ModelChunk } from '../types.js';

export class GroqAdapter implements ModelProvider {
  readonly providerId = 'groq';
  readonly name = 'Groq Cloud';
  readonly isLocal = false;

  async validateCredential(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!apiKey || apiKey.trim().length < 10) {
        return { valid: false, error: 'Invalid API key format.' };
      }
      const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
      const models = await client.models.list();
      if (models?.data && models.data.length > 0) {
        return { valid: true };
      }
      return { valid: false, error: 'Could not list models for this credential.' };
    } catch (err: any) {
      return { valid: false, error: err?.message || 'Failed to authenticate Groq API key.' };
    }
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    const apiKey = request.apiKey;
    if (!apiKey) {
      throw new Error('Groq API key is missing. Please connect your credential.');
    }

    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const model = request.model || 'llama-3.3-70b-versatile';
    const tools = request.tools || [];

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      ...request.history.map((h) => ({
        role: h.role === 'assistant' ? ('assistant' as const) : h.role === 'user' ? ('user' as const) : ('system' as const),
        content: h.content,
      })),
    ];

    const openAiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const candidateModels = [model, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'].filter(
      (m, idx, arr) => arr.indexOf(m) === idx
    );

    let completion: OpenAI.Chat.ChatCompletion | null = null;
    let usedModel = model;
    let lastError: any = null;

    for (const m of candidateModels) {
      try {
        completion = await client.chat.completions.create({
          model: m,
          messages,
          tools: openAiTools.length > 0 ? openAiTools : undefined,
          tool_choice: openAiTools.length > 0 ? 'auto' : undefined,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048,
        });
        usedModel = m;
        break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!completion) {
      throw new Error(lastError?.message || 'Groq completion failed across available models.');
    }

    const choice = completion.choices[0];
    const message = choice?.message;
    const rawReply = message?.content || '';
    const executedActions: Array<{ toolName: string; params: any; result: any }> = [];

    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [...messages, message];

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        let args: any = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }

        const targetTool = tools.find((t) => t.name === toolName);
        if (targetTool) {
          try {
            const result = await targetTool.execute(args, request.authToken);
            executedActions.push({ toolName, params: args, result });
            toolMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (err: any) {
            executedActions.push({ toolName, params: args, result: { error: err.message } });
            toolMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: err.message }),
            });
          }
        }
      }

      try {
        const followUp = await client.chat.completions.create({
          model: usedModel,
          messages: toolMessages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048,
        });

        const followUpReply = followUp.choices[0]?.message?.content || rawReply;
        return {
          reply: cleanThinking(followUpReply),
          executedActions,
          modelUsed: usedModel,
          latencyMs: Date.now() - startTime,
        };
      } catch {
        return {
          reply: cleanThinking(rawReply) || 'Actions executed successfully.',
          executedActions,
          modelUsed: usedModel,
          latencyMs: Date.now() - startTime,
        };
      }
    }

    return {
      reply: cleanThinking(rawReply),
      executedActions,
      modelUsed: usedModel,
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

function cleanThinking(text: string): string {
  if (text.includes('</think>')) {
    const parts = text.split('</think>');
    return parts[parts.length - 1].trim();
  }
  return text.trim();
}
