export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: any[];
  toolResults?: any[];
  timestamp: string;
}

export class SessionMemory {
  private static instance: SessionMemory;
  private sessions: Map<string, ChatMessage[]> = new Map();
  private maxHistoryPerSession = 25;

  private constructor() {}

  public static getInstance(): SessionMemory {
    if (!SessionMemory.instance) {
      SessionMemory.instance = new SessionMemory();
    }
    return SessionMemory.instance;
  }

  public getHistory(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId) || [];
  }

  public addMessage(sessionId: string, message: ChatMessage): void {
    const history = this.sessions.get(sessionId) || [];
    history.push(message);

    // Prune if exceeds max limit (keeping recent context)
    if (history.length > this.maxHistoryPerSession) {
      history.splice(0, history.length - this.maxHistoryPerSession);
    }
    this.sessions.set(sessionId, history);
  }

  public clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
