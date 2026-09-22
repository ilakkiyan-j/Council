import OpenAI from 'openai';
import { ProviderCallParams, ProviderResponse } from './gemini.js';

export async function callGroq(params: ProviderCallParams): Promise<ProviderResponse> {
  const { apiKey, model = 'llama-3.3-70b-versatile', systemPrompt, history, tools = [], authToken } = params;

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

  // Map tools to OpenAI tool format
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
  let lastError: any = null;

  for (const m of candidateModels) {
    try {
      completion = await client.chat.completions.create({
        model: m,
        messages,
        tools: openAiTools.length > 0 ? openAiTools : undefined,
        tool_choice: openAiTools.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 2048,
      });
      break;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Groq] Model ${m} failed, trying fallback:`, err?.message);
    }
  }

  if (!completion) {
    throw new Error(lastError?.message || 'Groq completion failed across available models.');
  }

  const choice = completion.choices[0];
  const message = choice?.message;
  const rawReply = message?.content || '';
  const executedActions: Array<{ toolName: string; params: any; result: any }> = [];

  // Check if tool_calls were returned
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const toolMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      ...messages,
      message,
    ];

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
          const result = await targetTool.execute(args, authToken);
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

    // Call Groq again with the tool outputs
    try {
      const followUp = await client.chat.completions.create({
        model: candidateModels[0],
        messages: toolMessages,
        temperature: 0.7,
        max_tokens: 2048,
      });

      const followUpReply = followUp.choices[0]?.message?.content || rawReply;
      return {
        reply: cleanThinking(followUpReply),
        executedActions,
      };
    } catch {
      // Return original reply with actions if second call fails
      return {
        reply: cleanThinking(rawReply) || 'Done! I updated your Nox workspace.',
        executedActions,
      };
    }
  }

  return {
    reply: cleanThinking(rawReply),
    executedActions,
  };
}

function cleanThinking(text: string): string {
  if (text.includes('</think>')) {
    const parts = text.split('</think>');
    return parts[parts.length - 1].trim();
  }
  return text.trim();
}
