import OpenAI from 'openai';
import { ProviderCallParams, ProviderResponse } from './gemini.js';

export async function callGroq(params: ProviderCallParams): Promise<ProviderResponse> {
  const { apiKey, model = 'qwen/qwen3.8-27b', systemPrompt, history } = params;

  if (!apiKey) {
    return {
      reply: `Groq API Key is not configured. To activate this persona, grab a 100% free key at https://console.groq.com and set GROQ_API_KEY in Council/.env!`,
      executedActions: [],
    };
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({
      role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: h.content,
    })),
  ];

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
  });

  const rawReply = completion.choices[0]?.message?.content || '';

  // If DeepSeek-R1 outputs thinking tags <think>...</think>, format nicely
  let cleanReply = rawReply;
  if (cleanReply.includes('</think>')) {
    const parts = cleanReply.split('</think>');
    cleanReply = parts[parts.length - 1].trim();
  }

  return {
    reply: cleanReply,
    executedActions: [],
  };
}
