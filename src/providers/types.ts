import { ToolDefinition } from '../connectors/nox/types.js';

export interface MessageTurn {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: any[];
  name?: string;
}

export interface ModelRequest {
  model: string;
  systemPrompt: string;
  history: MessageTurn[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  apiKey?: string;
  customEndpoint?: string;
  authToken?: string; // App-level auth token for tool calls (e.g. Nox Bearer token)
}

export interface ModelResponse {
  reply: string;
  executedActions: Array<{
    toolName: string;
    params: any;
    result: any;
  }>;
  tokensUsed?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  latencyMs?: number;
  modelUsed: string;
}

export interface ModelChunk {
  type: 'start' | 'delta' | 'tool_call' | 'done' | 'error';
  text?: string;
  toolName?: string;
  toolArgs?: any;
  executedActions?: Array<{ toolName: string; params: any; result: any }>;
  error?: string;
}

export interface ModelProvider {
  readonly providerId: string;
  readonly name: string;
  readonly isLocal: boolean;
  
  generate(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<ModelChunk>;
  validateCredential(apiKey: string, customEndpoint?: string): Promise<{ valid: boolean; error?: string }>;
}
