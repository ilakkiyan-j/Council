import { SessionStore, ChatMessage, SessionData } from './memory/sessionStore.js';
import { ProfileStore, UserProfileMemory } from './memory/profileStore.js';

export { ChatMessage, SessionData, UserProfileMemory };

export class SessionMemory {
  private static instance: SessionMemory;
  private sessionStore: SessionStore;
  private profileStore: ProfileStore;

  private constructor() {
    this.sessionStore = SessionStore.getInstance();
    this.profileStore = ProfileStore.getInstance();
  }

  public static getInstance(): SessionMemory {
    if (!SessionMemory.instance) {
      SessionMemory.instance = new SessionMemory();
    }
    return SessionMemory.instance;
  }

  public getHistory(sessionId: string): ChatMessage[] {
    return this.sessionStore.getHistory(sessionId);
  }

  public addMessage(sessionId: string, message: ChatMessage, personaId?: string): void {
    this.sessionStore.addMessage(sessionId, message, personaId);
  }

  public clearSession(sessionId: string): boolean {
    return this.sessionStore.clearSession(sessionId);
  }

  public listSessions() {
    return this.sessionStore.listSessions();
  }

  public getSession(sessionId: string) {
    return this.sessionStore.getSession(sessionId);
  }

  public getProfile(userId: string, userName?: string): UserProfileMemory {
    return this.profileStore.getProfile(userId, userName);
  }

  public addFact(userId: string, fact: string, category?: any, sourcePersona?: string): void {
    this.profileStore.addFact(userId, fact, category, sourcePersona);
  }

  public addPersonaNote(userId: string, persona: 'sofi' | 'riven' | 'lucifer', note: string): void {
    this.profileStore.addPersonaNote(userId, persona, note);
  }

  public getFormattedMemoryContext(userId: string, activePersona?: string): string {
    return this.profileStore.getFormattedMemoryContext(userId, activePersona);
  }
}
