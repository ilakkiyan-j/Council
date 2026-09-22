import OpenAI from 'openai';
import { ModelProvider, ModelRequest, ModelResponse, ModelChunk } from '../types.js';

export class OpenAIAdapter implements ModelProvider {
  readonly providerId = 'openai';
  readonly name = 'OpenAI';
  readonly isLocal = false;

  async validateCredential(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!apiKey || apiKey.trim().length < 10) {
        return { valid: false, error: 'Invalid API key format.' };
      }
      const client = new OpenAI({ apiKey });
      const models = await client.models.list();
      if (models?.data && models.data.length > 0) {
        return { valid: true };
      }
      return { valid: false, error: 'Could not list models for this credential.' };
    } catch (err: any) {
      return { valid: false, error: err?.message || 'Failed to authenticate OpenAI API key.' };
    }
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    const apiKey = request.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key is missing. Please connect your credential.');
    }

    const client = new OpenAI({ apiKey });
    const model = request.model || 'gpt-4o-mini';
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

    const completion = await client.chat.completions.create({
      model,
      messages,
      tools: openAiTools.length > 0 ? openAiTools : undefined,
      tool_choice: openAiTools.length > 0 ? 'auto' : undefined,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2048,
    });

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
          model,
          messages: toolMessages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048,
        });

        const followUpReply = followUp.choices[0]?.message?.content || rawReply;
        return {
          reply: followUpReply,
          executedActions,
          modelUsed: model,
          latencyMs: Date.now() - startTime,
        };
      } catch {
        return {
          reply: rawReply || 'Actions executed successfully.',
          executedActions,
          modelUsed: model,
          latencyMs: Date.now() - startTime,
        };
      }
    }

    return {
      reply: rawReply,
      executedActions,
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
