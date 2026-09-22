import { ToolDefinition } from '../connectors/nox/types.js';
import { noxTools } from '../connectors/nox/tools.js';

export interface RegisteredTool {
  id: string;
  applicationSlug: string;
  name: string;
  description: string;
  category: 'tasks' | 'goals' | 'calendar' | 'habits' | 'learning' | 'notes' | 'search' | 'general';
  isMutating: boolean;
  requiredPermission: 'READ_ONLY' | 'ASK_BEFORE_ACTION' | 'AUTOMATIC';
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: any, authToken?: string) => Promise<any>;
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
    slug: 'xion',
    name: 'Xion Engineering Platform',
    description: 'Software architecture, microservices, repository analytics, and developer roadmaps.',
    icon: '🚀',
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
    description: 'Create a new strategic roadmap linked to an optional goal in Nox.',
    category: 'goals',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Roadmap title' },
        description: { type: 'string', description: 'Summary of the roadmap' },
        goalId: { type: 'string', description: 'Optional Goal ID' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_create_roadmap');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  // Nox Tasks
  {
    id: 'nox_create_task',
    applicationSlug: 'nox',
    name: 'nox_create_task',
    description: 'Create a new actionable task in Nox with optional priority and due date.',
    category: 'tasks',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Actionable title of the task' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Priority level' },
        dueDate: { type: 'string', description: 'ISO date string (YYYY-MM-DD)' },
        goalId: { type: 'string', description: 'Optional Goal ID' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_create_task');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  {
    id: 'nox_toggle_task',
    applicationSlug: 'nox',
    name: 'nox_toggle_task',
    description: 'Mark a task as completed or todo.',
    category: 'tasks',
    isMutating: true,
    requiredPermission: 'ASK_BEFORE_ACTION',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID of the task to update' },
        status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'COMPLETED'], description: 'New status' },
      },
      required: ['taskId', 'status'],
    },
    execute: async (args, authToken) => {
      const tool = noxTools.find((t) => t.name === 'nox_toggle_task');
      return tool ? tool.execute(args, authToken) : { error: 'Tool not found' };
    },
  },
  // Nox Calendar Events
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
];

/**
 * Filter tools allowed for a bot based on its active integrations and permissions
 */
export function resolveToolsForBot(
  integrations: Array<{ applicationId: string; application: { slug: string }; permissions: any }>
): ToolDefinition[] {
  const allowedTools: ToolDefinition[] = [];

  for (const integration of integrations) {
    const appSlug = integration.application.slug;
    const permissions = (integration.permissions as Record<string, string>) || {};

    const appTools = REGISTERED_TOOLS.filter((t) => t.applicationSlug === appSlug);
    for (const tool of appTools) {
      // Permission check: if permission is explicitly configured or default
      const categoryPerm = permissions[tool.category] || 'ASK_BEFORE_ACTION';
      if (categoryPerm === 'DISABLED') {
        continue;
      }
      // If action is mutating and permission is READ_ONLY, exclude mutating tool
      if (tool.isMutating && categoryPerm === 'READ_ONLY') {
        continue;
      }

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
