export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: any, authToken?: string) => Promise<any>;
}

export interface ExecutionResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  summary: string;
}
