import fs from 'fs';
import path from 'path';

export interface UserFact {
  id: string;
  category: 'preference' | 'habit' | 'goal' | 'tech_stack' | 'relationship' | 'general';
  fact: string;
  learnedAt: string;
  sourcePersona?: string;
}

export interface PersonaNotes {
  sofiNotes: string[];     // e.g. agreements, nicknames, sleep notes, motivation triggers
  rivenNotes: string[];    // e.g. architecture principles, preferred stacks, scalability priorities
  luciferNotes: string[];  // e.g. promises made, audited deadlines, weaknesses called out
}

export interface UserProfileMemory {
  userId: string;
  userName?: string;
  updatedAt: string;
  facts: UserFact[];
  personaNotes: PersonaNotes;
}

const MEMORY_DIR = path.resolve(process.cwd(), 'data', 'memory');

export class ProfileStore {
  private static instance: ProfileStore;
  private cache: Map<string, UserProfileMemory> = new Map();

  private constructor() {
    this.ensureDir();
    this.loadAllIntoCache();
  }

  public static getInstance(): ProfileStore {
    if (!ProfileStore.instance) {
      ProfileStore.instance = new ProfileStore();
    }
    return ProfileStore.instance;
  }

  private ensureDir(): void {
    try {
      if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[ProfileStore] Failed to create memory dir:', err);
    }
  }

  private getFilePath(userId: string): string {
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(MEMORY_DIR, `${safeId}.json`);
  }

  private loadAllIntoCache(): void {
    try {
      if (!fs.existsSync(MEMORY_DIR)) return;
      const files = fs.readdirSync(MEMORY_DIR);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = fs.readFileSync(path.join(MEMORY_DIR, file), 'utf-8');
          const data: UserProfileMemory = JSON.parse(raw);
          if (data && data.userId) {
            this.cache.set(data.userId, data);
          }
        } catch {
          // ignore corrupted files
        }
      }
    } catch (err) {
      console.warn('[ProfileStore] Error reading memory files:', err);
    }
  }

  private persist(profile: UserProfileMemory): void {
    try {
      this.ensureDir();
      const filePath = this.getFilePath(profile.userId);
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[ProfileStore] Failed to persist profile for ${profile.userId}:`, err);
    }
  }

  public getProfile(userId: string, userName?: string): UserProfileMemory {
    let profile = this.cache.get(userId);
    if (!profile) {
      profile = {
        userId,
        userName,
        updatedAt: new Date().toISOString(),
        facts: [
          {
            id: 'fact-init-1',
            category: 'preference',
            fact: 'User is building the 0-OS ecosystem (Nox life OS, Xion engineering platform, Council AI agent hub).',
            learnedAt: new Date().toISOString(),
          },
        ],
        personaNotes: {
          sofiNotes: [
            'Cherishes warm and loving dynamic with Sofi; appreciates proactive scheduling and affectionate reminders.',
          ],
          rivenNotes: [
            'Values modular, scalable, clean architecture; prefers concrete technical breakdowns over vague advice.',
          ],
          luciferNotes: [
            'Appreciates brutal honesty and reality-checks when plans are unrealistic or when procrastination creeps in.',
          ],
        },
      };
      this.cache.set(userId, profile);
      this.persist(profile);
    }
    return profile;
  }

  public addFact(
    userId: string,
    fact: string,
    category: UserFact['category'] = 'general',
    sourcePersona?: string
  ): void {
    const profile = this.getProfile(userId);
    // Avoid duplicate facts
    const exists = profile.facts.some(
      (f) => f.fact.toLowerCase().trim() === fact.toLowerCase().trim()
    );
    if (!exists) {
      profile.facts.push({
        id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category,
        fact: fact.trim(),
        learnedAt: new Date().toISOString(),
        sourcePersona,
      });
      profile.updatedAt = new Date().toISOString();
      this.persist(profile);
    }
  }

  public addPersonaNote(
    userId: string,
    persona: 'sofi' | 'riven' | 'lucifer',
    note: string
  ): void {
    const profile = this.getProfile(userId);
    const key = `${persona}Notes` as keyof PersonaNotes;
    if (!profile.personaNotes[key]) {
      profile.personaNotes[key] = [];
    }
    if (!profile.personaNotes[key].includes(note.trim())) {
      profile.personaNotes[key].push(note.trim());
      profile.updatedAt = new Date().toISOString();
      this.persist(profile);
    }
  }

  public getFormattedMemoryContext(userId: string, activePersona?: string): string {
    const profile = this.getProfile(userId);
    const factsList = profile.facts.map((f) => `  - [${f.category}] ${f.fact}`).join('\n');

    let personaSpecific = '';
    if (activePersona === 'sofi' && profile.personaNotes.sofiNotes.length > 0) {
      personaSpecific = `\n- Sofi's Memories & Bond:\n${profile.personaNotes.sofiNotes.map((n) => `  * ${n}`).join('\n')}`;
    } else if (activePersona === 'riven' && profile.personaNotes.rivenNotes.length > 0) {
      personaSpecific = `\n- Riven's Architecture Log:\n${profile.personaNotes.rivenNotes.map((n) => `  * ${n}`).join('\n')}`;
    } else if (activePersona === 'lucifer' && profile.personaNotes.luciferNotes.length > 0) {
      personaSpecific = `\n- Lucifer's Audit Records:\n${profile.personaNotes.luciferNotes.map((n) => `  * ${n}`).join('\n')}`;
    }

    return `### Permanent Long-Term Memory (Across All Sessions):
- Stored User Profile & Preferences:
${factsList}${personaSpecific}`;
  }
}
