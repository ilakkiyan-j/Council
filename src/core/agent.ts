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

  // Retrieve previous conversation history
  const history = memory.getHistory(sessionId);

  // Add the new user message
  history.push({
    role: 'user',
    content: request.message,
    timestamp: new Date().toISOString(),
  });

  // Build dynamic prompt injecting current context
  let dynamicPrompt = persona.systemPrompt;
  if (request.userContext) {
    const ctx = request.userContext;
    const taskLines = ctx.tasks && ctx.tasks.length > 0
      ? ctx.tasks.map((t: any) => `  * [${t.priority || 'MEDIUM'}] "${t.title}" (Status: ${t.status}${t.dueDate ? `, Due: ${t.dueDate}` : ''}${t.goal ? `, Goal: ${t.goal.title}` : ''})`).join('\n')
      : '  * No pending tasks! The user is all caught up.';

    const eventLines = ctx.upcomingEvents && ctx.upcomingEvents.length > 0
      ? ctx.upcomingEvents.map((e: any) => `  * "${e.title}" on ${e.date}${e.startTime ? ` at ${e.startTime}` : ''}`).join('\n')
      : '  * No upcoming events scheduled.';

    const habitLines = ctx.habits && ctx.habits.length > 0
      ? ctx.habits.map((h: any) => `  * "${h.title}": 🔥 ${h.streakCount} day streak`).join('\n')
      : '  * No active habits tracked.';

    const reminderLines = ctx.reminders && ctx.reminders.length > 0
      ? ctx.reminders.map((r: any) => `  * "${r.title}" (Remind at: ${r.remindAt})`).join('\n')
      : '  * No active reminders.';

    dynamicPrompt += `\n\n### Current User Real-Time Context:
- Current Local Time: ${ctx.localTime || new Date().toLocaleString()}
- User Name: ${ctx.userName || 'Partner'}
- Pending Tasks List (${ctx.activeTasksCount ?? (ctx.tasks?.length || 0)} total):
${taskLines}
- Calendar & Upcoming Schedule:
${eventLines}
- Daily Habits & Streaks:
${habitLines}
- Active Prompts & Reminders:
${reminderLines}

IMPORTANT: You have full real-time visibility into the user's tasks, events, and habits listed above. When the user asks about their tasks or day, analyze these specific items directly with advice and recommendations! You can also execute tools to create, toggle, or modify them.`;
  }

  let result;
  if (persona.llmProvider === 'gemini') {
    result = await callGemini({
      apiKey: config.geminiApiKey,
      model: persona.defaultModel,
      systemPrompt: dynamicPrompt,
      history,
      tools: personaId === 'sofi' ? noxTools : [],
      authToken: request.authToken,
    });
  } else {
    // Groq (Riven or Lucifer)
    result = await callGroq({
      apiKey: config.groqApiKey,
      model: persona.defaultModel,
      systemPrompt: dynamicPrompt,
      history,
      tools: [],
      authToken: request.authToken,
    });
  }

  // Save assistant reply to memory
  memory.addMessage(sessionId, {
    role: 'assistant',
    content: result.reply,
    toolCalls: result.executedActions.map((a) => ({ name: a.toolName, params: a.params })),
    toolResults: result.executedActions.map((a) => a.result),
    timestamp: new Date().toISOString(),
  });

  return {
    persona: personaId,
    personaName: persona.name,
    reply: result.reply,
    sessionId,
    executedActions: result.executedActions,
  };
}
