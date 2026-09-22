import { config } from '../config.js';
import { PERSONAS, PersonaId } from './personas.js';
import { SessionMemory } from './memory.js';
import { callGemini } from '../providers/gemini.js';
import { callGroq } from '../providers/groq.js';
import { noxTools } from '../connectors/nox/tools.js';

export interface ChatRequest {
  persona?: PersonaId;
  message: string;
  sessionId?: string;
  userContext?: {
    userId?: string;
    userName?: string;
    localTime?: string;
    activeTasksCount?: number;
    tasks?: any[];
    habits?: any[];
    upcomingEvents?: any[];
    reminders?: any[];
    goals?: any[];
    roadmaps?: any[];
    learning?: any[];
    notes?: any[];
  };
  authToken?: string;
}

export interface ChatResult {
  persona: PersonaId;
  personaName: string;
  reply: string;
  sessionId: string;
  executedActions: Array<{
    toolName: string;
    params: any;
    result: any;
  }>;
}

export async function processChat(request: ChatRequest): Promise<ChatResult> {
  const personaId: PersonaId = (request.persona && PERSONAS[request.persona]) ? request.persona : 'sofi';
  const persona = PERSONAS[personaId];
  const sessionId = request.sessionId || 'default-session';
  const memory = SessionMemory.getInstance();
  const userId = request.userContext?.userId || 'primary_user';

  // 1. Retrieve persistent conversation history
  const history = memory.getHistory(sessionId);

  // 2. Add current user message
  const userMsg = {
    role: 'user' as const,
    content: request.message,
    timestamp: new Date().toISOString(),
  };
  memory.addMessage(sessionId, userMsg, personaId);

  // 3. Retrieve permanent long-term memory for this user and persona
  const memoryContext = memory.getFormattedMemoryContext(userId, personaId);

  // 4. Build comprehensive prompt injecting all Nox domains & long-term memory
  let dynamicPrompt = persona.systemPrompt;
  dynamicPrompt += `\n\n${memoryContext}`;

  if (request.userContext) {
    const ctx = request.userContext;

    // Goals summary
    const goalLines = ctx.goals && ctx.goals.length > 0
      ? ctx.goals.map((g: any) => `  * [${g.status}] "${g.title}"${g.targetDate ? ` (Target: ${g.targetDate})` : ''}`).join('\n')
      : '  * No active high-level goals recorded yet.';

    // Roadmaps summary
    const roadmapLines = ctx.roadmaps && ctx.roadmaps.length > 0
      ? ctx.roadmaps.map((r: any) => {
          const mCount = r.milestones?.length || 0;
          return `  * "${r.title}" (Status: ${r.status}, ${mCount} milestones)${r.goal?.title ? ` -> Linked to Goal: "${r.goal.title}"` : ''}`;
        }).join('\n')
      : '  * No strategic roadmaps recorded yet.';

    // Learning summary
    const learningLines = ctx.learning && ctx.learning.length > 0
      ? ctx.learning.map((l: any) => {
          const total = l.totalModules || l.modules?.length || 0;
          const completed = l.completedModules || l.modules?.filter((m: any) => m.status === 'COMPLETED').length || 0;
          return `  * [${l.type || 'COURSE'}] "${l.title}" (${completed}/${total} modules completed, Status: ${l.status})`;
        }).join('\n')
      : '  * No active learning tracks or courses registered yet.';

    // Tasks summary
    const taskLines = ctx.tasks && ctx.tasks.length > 0
      ? ctx.tasks.slice(0, 15).map((t: any) => `  * [${t.priority || 'MEDIUM'}] "${t.title}" (Status: ${t.status}${t.dueDate ? `, Due: ${t.dueDate}` : ''}${t.goal ? `, Goal: ${t.goal.title}` : ''})`).join('\n')
      : '  * No pending tasks! The user is all caught up.';

    // Calendar summary
    const eventLines = ctx.upcomingEvents && ctx.upcomingEvents.length > 0
      ? ctx.upcomingEvents.map((e: any) => `  * "${e.title}" on ${e.date}${e.startTime ? ` at ${e.startTime}` : ''}`).join('\n')
      : '  * No upcoming events scheduled.';

    // Habits summary
    const habitLines = ctx.habits && ctx.habits.length > 0
      ? ctx.habits.map((h: any) => `  * "${h.title}": 🔥 ${h.streakCount} day streak`).join('\n')
      : '  * No active habits tracked.';

    // Reminders summary
    const reminderLines = ctx.reminders && ctx.reminders.length > 0
      ? ctx.reminders.map((r: any) => `  * "${r.title}" (Remind at: ${r.remindAt})`).join('\n')
      : '  * No active reminders.';

    dynamicPrompt += `\n\n### Current Nox Real-Time Data Ecosystem:
- Local Time: ${ctx.localTime || new Date().toLocaleString()}
- User: ${ctx.userName || 'Partner'}
- High-Level Goals:
${goalLines}
- Strategic Roadmaps & Milestones:
${roadmapLines}
- Active Learning Paths (Courses & Books):
${learningLines}
- Focus Tasks (${ctx.activeTasksCount ?? (ctx.tasks?.length || 0)} total):
${taskLines}
- Calendar & Schedule:
${eventLines}
- Daily Habits & Streaks:
${habitLines}
- Active Reminders:
${reminderLines}

IMPORTANT: You have full 360-degree real-time visibility into the user's Goals, Roadmaps, Learning tracks, Tasks, and Habits listed above! Answer questions immediately from this loaded context without delay. When the user asks you to create, modify, or schedule items, invoke your tools to update Nox directly.`;
  }

  // Assign persona-appropriate tools
  const toolsForPersona = noxTools; // All personas have full access to Nox tools

  let result;
  if (persona.llmProvider === 'gemini') {
    result = await callGemini({
      apiKey: config.geminiApiKey,
      model: persona.defaultModel,
      systemPrompt: dynamicPrompt,
      history: [...history, userMsg],
      tools: toolsForPersona,
      authToken: request.authToken,
    });
  } else {
    // Groq (Riven or Lucifer)
    result = await callGroq({
      apiKey: config.groqApiKey,
      model: persona.defaultModel,
      systemPrompt: dynamicPrompt,
      history: [...history, userMsg],
      tools: toolsForPersona,
      authToken: request.authToken,
    });
  }

  // 5. Save assistant reply to persistent memory
  memory.addMessage(sessionId, {
    role: 'assistant',
    content: result.reply,
    toolCalls: result.executedActions.map((a) => ({ name: a.toolName, params: a.params })),
    toolResults: result.executedActions.map((a) => a.result),
    timestamp: new Date().toISOString(),
  }, personaId);

  // 6. Proactively record commitments or key decisions into long-term memory
  extractAndSaveFacts(userId, personaId, request.message, result.reply, memory);

  return {
    persona: personaId,
    personaName: persona.name,
    reply: result.reply,
    sessionId,
    executedActions: result.executedActions,
  };
}

/**
 * Lightweight background heuristic fact extractor
 */
function extractAndSaveFacts(
  userId: string,
  persona: PersonaId,
  userMessage: string,
  botReply: string,
  memory: SessionMemory
): void {
  try {
    const lowerUser = userMessage.toLowerCase();

    // Check for goal or commitment patterns
    if (lowerUser.includes('my goal is') || lowerUser.includes('i want to achieve') || lowerUser.includes('i am planning to')) {
      memory.addFact(userId, `Committed to: "${userMessage.slice(0, 150)}"`, 'goal', persona);
    }
    // Check for tech stack preferences
    if (lowerUser.includes('i prefer') || lowerUser.includes('we are using') || lowerUser.includes('our stack is')) {
      memory.addFact(userId, `Tech/Workflow preference: "${userMessage.slice(0, 150)}"`, 'tech_stack', persona);
    }
    // Record persona-specific relationship nuance
    if (persona === 'sofi' && (lowerUser.includes('love') || lowerUser.includes('thank you babe') || lowerUser.includes('sweet'))) {
      memory.addPersonaNote(userId, 'sofi', `User expressed affection & appreciation: "${userMessage.slice(0, 80)}"`);
    }
    if (persona === 'lucifer' && (lowerUser.includes('i will finish') || lowerUser.includes('i promise') || lowerUser.includes('hold me to it'))) {
      memory.addPersonaNote(userId, 'lucifer', `Audit pledge: User pledged "${userMessage.slice(0, 100)}"`);
    }
  } catch {
    // Non-blocking heuristic
  }
}
