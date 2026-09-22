import fs from 'fs';
import path from 'path';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: any[];
  toolResults?: any[];
  timestamp: string;
}

export interface SessionData {
  sessionId: string;
  personaId?: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
  messages: ChatMessage[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data', 'sessions');

export class SessionStore {
  private static instance: SessionStore;
  private cache: Map<string, SessionData> = new Map();
  private maxMessagesPerSession = 40;

  private constructor() {
    this.ensureDir();
    this.loadAllIntoCache();
  }

  public static getInstance(): SessionStore {
    if (!SessionStore.instance) {
      SessionStore.instance = new SessionStore();
    }
    return SessionStore.instance;
  }

  private ensureDir(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[SessionStore] Failed to ensure data directory:', err);
    }
  }

  private getFilePath(sessionId: string): string {
    // Sanitize sessionId for filesystem safety
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(DATA_DIR, `${safeId}.json`);
  }

  private loadAllIntoCache(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) return;
      const files = fs.readdirSync(DATA_DIR);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
          const data: SessionData = JSON.parse(raw);
          if (data && data.sessionId) {
            this.cache.set(data.sessionId, data);
          }
        } catch {
          // ignore corrupted files
        }
      }
    } catch (err) {
      console.warn('[SessionStore] Error reading session files from disk:', err);
    }
  }

  private persistSession(session: SessionData): void {
    try {
      this.ensureDir();
      const filePath = this.getFilePath(session.sessionId);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[SessionStore] Failed to persist session ${session.sessionId}:`, err);
    }
  }

  public getSession(sessionId: string, personaId?: string): SessionData {
    let session = this.cache.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        personaId: personaId || 'sofi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      this.cache.set(sessionId, session);
      this.persistSession(session);
    }
    return session;
  }

  public getHistory(sessionId: string): ChatMessage[] {
    const session = this.getSession(sessionId);
    return session.messages;
  }

  public addMessage(sessionId: string, message: ChatMessage, personaId?: string): void {
    const session = this.getSession(sessionId, personaId);
    if (personaId && !session.personaId) {
      session.personaId = personaId;
    }

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();

    // Prune if exceeds maxMessagesPerSession, keeping most recent turns
    if (session.messages.length > this.maxMessagesPerSession) {
      session.messages = session.messages.slice(session.messages.length - this.maxMessagesPerSession);
    }

    this.persistSession(session);
  }

  public listSessions(): Array<{
    sessionId: string;
    personaId?: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    lastMessagePreview?: string;
  }> {
    const list = Array.from(this.cache.values()).map((s) => {
      const lastMsg = s.messages[s.messages.length - 1];
      return {
        sessionId: s.sessionId,
        personaId: s.personaId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
        lastMessagePreview: lastMsg ? lastMsg.content.slice(0, 100) : undefined,
      };
    });

    // Sort by latest update descending
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public clearSession(sessionId: string): boolean {
    this.cache.delete(sessionId);
    try {
      const filePath = this.getFilePath(sessionId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (err) {
      console.error(`[SessionStore] Failed to remove session ${sessionId}:`, err);
      return false;
    }
  }
}
