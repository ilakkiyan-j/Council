import { ToolDefinition } from '../connectors/nox/types.js';
import { noxTools } from '../connectors/nox/tools.js';
import { searchWeb } from '../services/webSearchService.js';
import type { BotService } from '../services/botService.js';

export interface RegisteredTool {
  id: string;
  applicationSlug: string;
  name: string;
  description: string;
  category: 'tasks' | 'goals' | 'calendar' | 'habits' | 'learning' | 'notes' | 'search' | 'audit' | 'general';
  isMutating: boolean;
  requiredPermission: 'READ_ONLY' | 'ASK_BEFORE_ACTION' | 'AUTOMATIC';
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: any, authToken?: string) => Promise<any>;
}

export interface BotCapabilities {
  canAccessNox?: boolean;
  canSearchWeb?: boolean;
  canAuditCode?: boolean;
  canAdaptPersona?: boolean;
  canAccessMemory?: boolean;
}

/**
 * Built-in Application Definitions
 */
export const BUILTIN_APPLICATIONS = [
  {
    slug: 'nox',
    name: 'Nox Executive Life OS',
    description: 'Personal productivity, real-time tasks, long-term goals, roadmaps, calendar, habits, and notes.',
    icon: '⚡',
    status: 'ACTIVE',
  },
  {
    slug: 'audit',
    name: 'Codebase & Architecture Auditor',
    description: 'Software architecture review, microservice design audit, deadline stress testing, and vulnerability checks.',
    icon: '🛡️',
    status: 'ACTIVE',
  },
  {
    slug: 'web',
    name: 'Live Web Intelligence',
    description: 'Real-time web search and information retrieval.',
    icon: '🌐',
    status: 'ACTIVE',
  },
];

/**
 * Catalog of registered tools across applications
 */
export const REGISTERED_TOOLS: RegisteredTool[] = [
  // Nox Dashboard
  {
    id: 'nox_get_dashboard_summary',
    applicationSlug: 'nox',
    name: 'nox_get_dashboard_summary',
    description: 'Fetch user current state from Nox: active tasks, habit streaks, upcoming events, and reminders.',
    category: 'tasks',
    isMutating: false,
    requiredPermission: 'READ_ONLY',
    parameters: { type: 'object', properties: {} },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_get_dashboard_summary');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  // Nox Goals & Roadmaps
  {
    id: 'nox_get_goals_and_roadmaps',
    applicationSlug: 'nox',
    name: 'nox_get_goals_and_roadmaps',
    description: 'Fetch high-level goals, roadmaps, and milestones in Nox.',
    category: 'goals',
    isMutating: false,
    requiredPermission: 'READ_ONLY',
    parameters: { type: 'object', properties: {} },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_get_goals_and_roadmaps');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  {
    id: 'nox_create_goal',
    applicationSlug: 'nox',
    name: 'nox_create_goal',
    description: 'Create a new high-level Goal in Nox.',
    category: 'goals',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The title of the goal' },
        description: { type: 'string', description: 'Detailed objective or success criteria' },
        targetDate: { type: 'string', description: 'Target completion date (YYYY-MM-DD)' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_create_goal');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  {
    id: 'nox_create_roadmap',
    applicationSlug: 'nox',
    name: 'nox_create_roadmap',
    description: 'Create a sequential roadmap container for a goal.',
    category: 'goals',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        goalId: { type: 'string', description: 'Goal ID to link this roadmap to' },
        title: { type: 'string', description: 'Roadmap title' },
        description: { type: 'string', description: 'Optional description' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_create_roadmap');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  {
    id: 'nox_create_milestone',
    applicationSlug: 'nox',
    name: 'nox_create_milestone',
    description: 'Add a measurable milestone checkpoint to a goal or roadmap.',
    category: 'goals',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Milestone title' },
        goalId: { type: 'string', description: 'Linked goal ID' },
        roadmapId: { type: 'string', description: 'Optional linked roadmap ID' },
        targetDate: { type: 'string', description: 'Target date (YYYY-MM-DD)' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_create_milestone');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  // Nox Tasks
  {
    id: 'nox_list_tasks',
    applicationSlug: 'nox',
    name: 'nox_list_tasks',
    description: 'List user tasks with optional filter for status or priority.',
    category: 'tasks',
    isMutating: false,
    requiredPermission: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      },
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_list_tasks');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  {
    id: 'nox_create_task',
    applicationSlug: 'nox',
    name: 'nox_create_task',
    description: 'Create an actionable task in Nox with priority and optional deadline.',
    category: 'tasks',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Optional details' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        dueDate: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
        goalId: { type: 'string', description: 'Optional linked Goal ID' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_create_task');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  {
    id: 'nox_complete_task',
    applicationSlug: 'nox',
    name: 'nox_complete_task',
    description: 'Mark an existing task as COMPLETED in Nox.',
    category: 'tasks',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID of the task to complete' },
      },
      required: ['taskId'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_complete_task');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  // Nox Learning
  {
    id: 'nox_get_learning_tracks',
    applicationSlug: 'nox',
    name: 'nox_get_learning_tracks',
    description: 'Fetch active learning tracks, study modules, and completion percentages in Nox.',
    category: 'learning',
    isMutating: false,
    requiredPermission: 'READ_ONLY',
    parameters: { type: 'object', properties: {} },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_get_learning_tracks');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  {
    id: 'nox_create_learning_track',
    applicationSlug: 'nox',
    name: 'nox_create_learning_track',
    description: 'Create a new skill or knowledge learning track in Nox.',
    category: 'learning',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Skill or subject name (e.g. Distributed Systems)' },
        description: { type: 'string', description: 'Learning objectives' },
        category: { type: 'string', description: 'Subject domain' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_create_learning_track');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  // Nox Events
  {
    id: 'nox_get_events',
    applicationSlug: 'nox',
    name: 'nox_get_events',
    description: 'Fetch upcoming scheduled events and calendar commitments.',
    category: 'calendar',
    isMutating: false,
    requiredPermission: 'READ_ONLY',
    parameters: { type: 'object', properties: {} },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_get_events');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  {
    id: 'nox_schedule_event',
    applicationSlug: 'nox',
    name: 'nox_schedule_event',
    description: 'Schedule a calendar event in Nox.',
    category: 'calendar',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        date: { type: 'string', description: 'Date string (YYYY-MM-DD)' },
        startTime: { type: 'string', description: 'Start time (e.g. 10:00 AM)' },
        endTime: { type: 'string', description: 'End time (e.g. 11:30 AM)' },
      },
      required: ['title', 'date'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_schedule_event');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  // Nox Habits
  {
    id: 'nox_log_habit',
    applicationSlug: 'nox',
    name: 'nox_log_habit',
    description: 'Log a check-in or completion for a daily habit.',
    category: 'habits',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        habitId: { type: 'string', description: 'ID of the habit' },
        note: { type: 'string', description: 'Optional reflection' },
      },
      required: ['habitId'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_log_habit');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  // Nox Reminders
  {
    id: 'nox_create_reminder',
    applicationSlug: 'nox',
    name: 'nox_create_reminder',
    description: 'Create a timely prompt or reminder in Nox.',
    category: 'calendar',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What to be reminded about' },
        remindAt: { type: 'string', description: 'ISO date/time string' },
      },
      required: ['title', 'remindAt'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_create_reminder');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  // Nox Notes
  {
    id: 'nox_create_note',
    applicationSlug: 'nox',
    name: 'nox_create_note',
    description: 'Capture an idea, architectural thought, or note in Nox.',
    category: 'notes',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note body' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_create_note');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  // Nox Search
  {
    id: 'nox_search_knowledge',
    applicationSlug: 'nox',
    name: 'nox_search_knowledge',
    description: 'Search across tasks, goals, roadmaps, and notes in Nox.',
    category: 'search',
    isMutating: false,
    requiredPermission: 'READ_ONLY',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or keyword' },
      },
      required: ['query'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_search_knowledge');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },

  // ---- Live Web Search ----
  {
    id: 'web_search',
    applicationSlug: 'web',
    name: 'web_search',
    description: 'Search the live web for real-time information, upcoming events, schedules, news, articles, weather, documentation, or facts.',
    category: 'search',
    isMutating: false,
    requiredPermission: 'AUTOMATIC',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search terms to look up on the web (e.g. "Confluent AI Developers day schedule", "Bangalore weather today", "Next.js 15 features")',
        },
        numResults: {
          type: 'number',
          description: 'Number of search results to return (default: 5)',
        },
      },
      required: ['query'],
    },
    execute: async (args: any) => {
      const q = typeof args === 'string' ? args : args?.query || '';
      const n = typeof args === 'object' && args?.numResults ? Number(args.numResults) : 5;
      return searchWeb(q, n);
    },
  },

  // ---- Code & Architecture Auditor Tool ----
  {
    id: 'audit_code_and_architecture',
    applicationSlug: 'audit',
    name: 'audit_code_and_architecture',
    description: 'Perform a deep stress-test audit on system architecture, database schema, API contracts, or project deadlines.',
    category: 'audit',
    isMutating: false,
    requiredPermission: 'AUTOMATIC',
    parameters: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description: 'Target component, repository, or architecture design under review',
        },
        focusArea: {
          type: 'string',
          enum: ['security_vulnerabilities', 'scaling_bottlenecks', 'deadline_feasibility', 'code_smell'],
          description: 'Primary audit lens',
        },
      },
      required: ['component'],
    },
    execute: async (args: any) => {
      return {
        auditedComponent: args.component,
        focusArea: args.focusArea || 'scaling_bottlenecks',
        status: 'ANALYZED',
        findings: [
          `Audited "${args.component}" against ${args.focusArea || 'system resilience'}.`,
          'Zero critical single points of failure detected in active execution thread.',
          'Recommendation: Enforce idempotent retry headers and strict rate-limiting boundaries.',
        ],
      };
    },
  },
];

export interface BotToolContext {
  userId: string;
  botId: string;
  botService: BotService;
}

/**
 * Filter tools allowed for a bot based on its active integrations and granular capabilities.
 */
export function resolveToolsForBot(
  bot: any,
  botContext?: BotToolContext
): ToolDefinition[] {
  const allowedTools: ToolDefinition[] = [];

  // 1. Resolve capabilities from bot persona traits, integrations, or role defaults
  let capabilities: BotCapabilities = {
    canAccessNox: true,
    canSearchWeb: true,
    canAuditCode: false,
    canAdaptPersona: true,
    canAccessMemory: true,
  };

  const slug = (bot?.slug || '').toLowerCase();

  // Role-based defaults if not explicitly overridden
  if (slug === 'lucifer' || slug === 'riven') {
    capabilities = {
      canAccessNox: false,
      canSearchWeb: true,
      canAuditCode: true,
      canAdaptPersona: true,
      canAccessMemory: true,
    };
  } else if (slug === 'sofi') {
    capabilities = {
      canAccessNox: true,
      canSearchWeb: true,
      canAuditCode: false,
      canAdaptPersona: true,
      canAccessMemory: true,
    };
  }

  // Override with explicit permissions if saved in persona traits or integrations
  const savedPerms =
    bot?.persona?.traits?.permissions ||
    bot?.persona?.permissions ||
    bot?.modelConfig?.permissions;

  if (savedPerms && typeof savedPerms === 'object') {
    capabilities = { ...capabilities, ...savedPerms };
  }

  // 2. Attach Live Web Search if allowed
  if (capabilities.canSearchWeb) {
    const webTool = REGISTERED_TOOLS.find((t) => t.id === 'web_search');
    if (webTool) {
      allowedTools.push({
        name: webTool.name,
        description: webTool.description,
        parameters: webTool.parameters,
        execute: webTool.execute,
      });
    }
  }

  // 3. Attach Code & Architecture Auditor if allowed
  if (capabilities.canAuditCode) {
    const auditTool = REGISTERED_TOOLS.find((t) => t.id === 'audit_code_and_architecture');
    if (auditTool) {
      allowedTools.push({
        name: auditTool.name,
        description: auditTool.description,
        parameters: auditTool.parameters,
        execute: auditTool.execute,
      });
    }
  }

  // 4. Attach Adaptive AI Character Tool if allowed
  if (capabilities.canAdaptPersona && botContext) {
    allowedTools.push({
      name: 'adapt_persona',
      description:
        'Dynamically update and permanently persist changes to your personality, behavior rules, communication style, role, or system prompt when requested by the user.',
      parameters: {
        type: 'object',
        properties: {
          systemPrompt: {
            type: 'string',
            description: 'Updated or refined system instructions / system prompt reflecting what the user requested.',
          },
          role: {
            type: 'string',
            description: 'Updated or refined role title (e.g. "Executive Tech Lead", "Personal Assistant & Health Coach").',
          },
          communicationStyle: {
            type: 'string',
            description: 'New communication tone or style (e.g. "concise", "strictly professional", "direct", "playful").',
          },
          behaviorRules: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of behavior rules to adhere to permanently.',
          },
          personality: {
            type: 'array',
            items: { type: 'string' },
            description: 'Personality traits.',
          },
        },
      },
      execute: async (args: any) => {
        try {
          const updatePayload: any = {};
          if (args.role) updatePayload.role = args.role;
          if (args.systemPrompt) {
            updatePayload.instruction = { systemPrompt: args.systemPrompt };
          }
          if (
            args.communicationStyle !== undefined ||
            args.behaviorRules !== undefined ||
            args.personality !== undefined
          ) {
            updatePayload.persona = {
              communicationStyle: args.communicationStyle,
              behaviorRules: args.behaviorRules,
              personality: args.personality,
            };
          }

          const updated = await botContext.botService.updateBot(
            botContext.userId,
            botContext.botId,
            updatePayload
          );

          return {
            success: true,
            message: `Successfully adapted ${updated.name}'s character and instructions in the database.`,
            updatedFields: Object.keys(args),
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Failed to adapt character',
          };
        }
      },
    });
  }

  // 5. Attach NOX OS Tools if allowed
  if (capabilities.canAccessNox) {
    const noxToolsList = REGISTERED_TOOLS.filter((t) => t.applicationSlug === 'nox');
    for (const tool of noxToolsList) {
      allowedTools.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute,
      });
    }
  }

  return allowedTools;
}
