import { ModelProvider, ModelRequest, ModelResponse, ModelChunk } from '../types.js';

export class GeminiAdapter implements ModelProvider {
  readonly providerId = 'gemini';
  readonly name = 'Google Gemini';
  readonly isLocal = false;

  async validateCredential(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!apiKey || apiKey.trim().length < 10) {
        return { valid: false, error: 'Invalid API key format.' };
      }
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        return { valid: true };
      }
      const errJson: any = await res.json().catch(() => ({}));
      return {
        valid: false,
        error: errJson?.error?.message || `Validation failed with HTTP ${res.status}`,
      };
    } catch (err: any) {
      return { valid: false, error: err?.message || 'Network error while validating Gemini API key.' };
    }
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    const apiKey = request.apiKey;
    if (!apiKey) {
      throw new Error('Google Gemini API key is missing. Please connect your credential.');
    }

    const model = request.model || 'gemini-2.5-flash';
    const tools = request.tools || [];
    const functionDeclarations = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'OBJECT',
        properties: tool.parameters.properties,
        required: tool.parameters.required || [],
      },
    }));

    const contents: any[] = [];
    for (const turn of request.history) {
      if (turn.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: turn.content }] });
      } else if (turn.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: turn.content }] });
      }
    }

    const requestBody: any = {
      contents,
      systemInstruction: {
        parts: [{ text: request.systemPrompt }],
      },
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 2048,
      },
    };

    if (functionDeclarations.length > 0) {
      requestBody.tools = [{ functionDeclarations }];
    }

    // Clean requested model string
    const rawRequested = (request.model || 'gemini-2.0-flash').replace(/^models\//, '').trim();

    // Dynamically discover supported generation models for this exact API key
    let verifiedKeyModels: string[] = [];
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listRes.ok) {
        const listData: any = await listRes.json();
        verifiedKeyModels = (listData.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''));
      }
    } catch {
      // ignore
    }

    const priorityOrder = [
      rawRequested,
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
    ];

    const candidateModels: string[] = [];
    for (const p of priorityOrder) {
      if (verifiedKeyModels.includes(p) && !candidateModels.includes(p)) {
        candidateModels.push(p);
      }
    }
    for (const v of verifiedKeyModels) {
      if (!candidateModels.includes(v)) {
        candidateModels.push(v);
      }
    }
    // Fallback if list endpoint failed
    if (candidateModels.length === 0) {
      candidateModels.push(rawRequested, 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash');
    }

    let response: Response | null = null;
    let usedModel = candidateModels[0];
    let lastErrorMessage = '';

    for (const m of candidateModels) {
      const endpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
        `https://generativelanguage.googleapis.com/v1/models/${m}:generateContent?key=${apiKey}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

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

      if (response && response.ok) {
        break;
      }
    }

    if (!response || !response.ok) {
      throw new Error(lastErrorMessage || 'Gemini service is currently unavailable. Please retry in a moment.');
    }

    const data: any = await response.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    const executedActions: Array<{ toolName: string; params: any; result: any }> = [];
    const functionCalls = parts.filter((p: any) => p.functionCall);

    if (functionCalls.length > 0) {
      // Execute requested tools
      const functionResponses: any[] = [];
      for (const fcPart of functionCalls) {
        const call = fcPart.functionCall;
        const targetTool = tools.find((t) => t.name === call.name);

        if (targetTool) {
          try {
            const result = await targetTool.execute(call.args || {}, request.authToken);
            executedActions.push({ toolName: call.name, params: call.args, result });
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { output: result },
              },
            });
          } catch (err: any) {
            executedActions.push({ toolName: call.name, params: call.args, result: { error: err.message } });
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { error: err.message },
              },
            });
          }
        }
      }

      // Feed function responses back to Gemini
      contents.push({ role: 'model', parts });
      contents.push({ role: 'user', parts: functionResponses });

      const secondEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${usedModel}:generateContent?key=${apiKey}`;
      const secondRes = await fetch(secondEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: request.systemPrompt }],
          },
        }),
      });

      if (secondRes.ok) {
        const secondData: any = await secondRes.json();
        const secondCandidate = secondData.candidates?.[0];
        const textParts = secondCandidate?.content?.parts?.filter((p: any) => p.text) || [];
        const reply = textParts.map((p: any) => p.text).join('\n').trim();
        return {
          reply: reply || 'Action completed successfully.',
          executedActions,
          modelUsed: usedModel,
          latencyMs: Date.now() - startTime,
        };
      }
    }

    const textParts = parts.filter((p: any) => p.text);
    const reply = textParts.map((p: any) => p.text).join('\n').trim();

    return {
      reply: reply || 'Ready to assist.',
      executedActions,
      modelUsed: usedModel,
      latencyMs: Date.now() - startTime,
    };
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelChunk> {
    yield { type: 'start' };
    try {
      const response = await this.generate(request);
      // Stream in readable word chunks
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
