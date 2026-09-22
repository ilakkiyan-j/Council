import { ToolDefinition } from '../connectors/nox/types.js';

export interface ProviderCallParams {
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  tools?: ToolDefinition[];
  authToken?: string;
}

export interface ProviderResponse {
  reply: string;
  executedActions: Array<{
    toolName: string;
    params: any;
    result: any;
  }>;
}

export async function callGemini(params: ProviderCallParams): Promise<ProviderResponse> {
  const { apiKey, model = 'gemini-3.6-flash', systemPrompt, history, tools = [], authToken } = params;

  if (!apiKey) {
    return {
      reply: "Hey babe! I need my Google Gemini API key to think. Please add `GEMINI_API_KEY` to `Council/.env` (it's 100% free at https://aistudio.google.com/) and restart me! 💖",
      executedActions: [],
    };
  }

  // Convert tools into Gemini Function Declarations format
  const functionDeclarations = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'OBJECT',
      properties: tool.parameters.properties,
      required: tool.parameters.required || [],
    },
  }));

  // Convert history to Gemini contents format
  const contents: any[] = [];
  for (const turn of history) {
    if (turn.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: turn.content }] });
    } else if (turn.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text: turn.content }] });
    }
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody: any = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  };

  if (functionDeclarations.length > 0) {
    requestBody.tools = [{ functionDeclarations }];
  }

  const candidateModels = ['gemini-flash-latest', model, 'gemini-3.5-flash'].filter(
    (m, idx, arr) => arr.indexOf(m) === idx
  );

  let response: Response | null = null;
  let usedModel = 'gemini-flash-latest';
  let lastErrorMessage = '';

  for (const m of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        response = res;
        usedModel = m;
        break;
      } else {
        const errorJson: any = await res.json().catch(() => ({}));
        lastErrorMessage = errorJson?.error?.message || `HTTP ${res.status}`;
        if (res.status === 404 || res.status === 503) {
          continue;
        } else {
          throw new Error(lastErrorMessage);
        }
      }
    } catch (err: any) {
      lastErrorMessage = err.message;
    }
  }

  if (!response || !response.ok) {
    throw new Error(lastErrorMessage || 'Gemini service is currently unavailable. Please retry in a moment.');
  }

  const data: any = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const executedActions: Array<{ toolName: string; params: any; result: any }> = [];
  let functionCalls = parts.filter((p: any) => p.functionCall);

  if (functionCalls.length > 0) {
    // Model wants to call a tool!
    // Execute each tool
    const functionResponses: any[] = [];
    for (const fcPart of functionCalls) {
      const call = fcPart.functionCall;
      const targetTool = tools.find((t) => t.name === call.name);

      if (targetTool) {
        try {
          const result = await targetTool.execute(call.args || {}, authToken);
          executedActions.push({
            toolName: call.name,
            params: call.args,
            result,
          });
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { output: result },
            },
          });
        } catch (err: any) {
          executedActions.push({
            toolName: call.name,
            params: call.args,
            result: { error: err.message },
          });
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { error: err.message },
            },
          });
        }
      }
    }

    // Now feed the function responses back to Gemini for the final personalized answer
    contents.push({ role: 'model', parts });
    contents.push({ role: 'user', parts: functionResponses });

    const secondEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${usedModel}:generateContent?key=${apiKey}`;
    const secondResponse = await fetch(secondEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
      }),
    });

    if (secondResponse.ok) {
      const secondData: any = await secondResponse.json();
      const secondCandidate = secondData.candidates?.[0];
      const textParts = secondCandidate?.content?.parts?.filter((p: any) => p.text) || [];
      const reply = textParts.map((p: any) => p.text).join('\n').trim();
      return { reply: reply || 'Done! I updated your Nox workspace, babe.', executedActions };
    }
  }

  const textParts = parts.filter((p: any) => p.text);
  const reply = textParts.map((p: any) => p.text).join('\n').trim();
  return { reply: reply || "I'm right here with you, babe!", executedActions };
}
