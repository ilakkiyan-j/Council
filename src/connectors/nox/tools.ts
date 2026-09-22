import { ToolDefinition } from './types.js';
import { noxClient } from './client.js';

export const noxTools: ToolDefinition[] = [
  // ---- Dashboard Summary ----
  {
    name: 'nox_get_dashboard_summary',
    description: 'Fetch user current state from Nox: active focus tasks, habit streaks, upcoming events, and reminders to negotiate plans.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_args, authToken) => {
      const data = await noxClient.getDashboard(authToken);
      return {
        activeTasksCount: data?.tasks?.length || 0,
        tasks: data?.tasks?.map((t: any) => ({ id: t.id, title: t.title, priority: t.priority, status: t.status, dueDate: t.dueDate })),
        habits: data?.habits?.map((h: any) => ({ id: h.id, title: h.title, streakCount: h.streakCount })),
        upcomingEvents: data?.upcomingEvents?.map((e: any) => ({ id: e.id, title: e.title, date: e.date, startTime: e.startTime })),
        reminders: data?.reminders?.map((r: any) => ({ id: r.id, title: r.title, remindAt: r.remindAt })),
      };
    },
  },

  // ---- Goals & Roadmaps ----
  {
    name: 'nox_get_goals_and_roadmaps',
    description: 'Fetch the user’s long-term Goals, Roadmaps, and Milestones in Nox to align daily actions with master plans.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_args, authToken) => {
      const [goals, roadmaps] = await Promise.all([
        noxClient.getGoals(authToken).catch(() => []),
        noxClient.getRoadmaps(authToken).catch(() => []),
      ]);
      return {
        goals: Array.isArray(goals) ? goals.map((g: any) => ({
          id: g.id,
          title: g.title,
          status: g.status,
          targetDate: g.targetDate,
          milestonesCount: g.milestones?.length || 0,
        })) : [],
        roadmaps: Array.isArray(roadmaps) ? roadmaps.map((r: any) => ({
          id: r.id,
          title: r.title,
          goalTitle: r.goal?.title,
          milestones: r.milestones?.map((m: any) => ({ id: m.id, title: m.title, status: m.status })),
        })) : [],
      };
    },
  },

  {
    name: 'nox_create_goal',
    description: 'Create a new high-level Goal in Nox.',
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
      const goal = await noxClient.createGoal(args, authToken);
      return { success: true, goalId: goal.id, title: goal.title, status: goal.status };
    },
  },

  {
    name: 'nox_create_roadmap',
    description: 'Create a new strategic roadmap linked to an optional goal.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Roadmap title (e.g. "Q4 Engineering Overhaul")' },
        description: { type: 'string', description: 'Summary of the roadmap' },
        goalId: { type: 'string', description: 'Optional Goal ID to link this roadmap to' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const roadmap = await noxClient.createRoadmap(args, authToken);
      return { success: true, roadmapId: roadmap.id, title: roadmap.title };
    },
  },

  {
    name: 'nox_create_roadmap_milestone',
    description: 'Break down an engineering system or project into a concrete milestone inside a Nox roadmap.',
    parameters: {
      type: 'object',
      properties: {
        roadmapId: { type: 'string', description: 'ID of the roadmap' },
        title: { type: 'string', description: 'Milestone title (e.g. "Phase 1: Event-driven Redis Pub/Sub")' },
        description: { type: 'string', description: 'Key deliverables of this milestone' },
        targetDate: { type: 'string', description: 'Target date (YYYY-MM-DD)' },
      },
      required: ['roadmapId', 'title'],
    },
    execute: async (args, authToken) => {
      const { roadmapId, ...data } = args;
      const milestone = await noxClient.createMilestone(roadmapId, data, authToken);
      return { success: true, milestoneId: milestone.id, title: milestone.title };
    },
  },

  // ---- Learning Tracks ----
  {
    name: 'nox_get_learning_progress',
    description: 'Fetch the user’s courses, books, certifications, and active learning modules in Nox.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_args, authToken) => {
      const learning = await noxClient.getLearning(authToken).catch(() => []);
      return {
        learningTracks: Array.isArray(learning) ? learning.map((l: any) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          status: l.status,
          totalModules: l.totalModules || l.modules?.length || 0,
          completedModules: l.completedModules || l.modules?.filter((m: any) => m.status === 'COMPLETED').length || 0,
          modules: l.modules?.map((m: any) => ({ id: m.id, title: m.title, status: m.status })),
        })) : [],
      };
    },
  },

  {
    name: 'nox_log_learning_module',
    description: 'Mark a specific learning module or book chapter as COMPLETED or IN_PROGRESS.',
    parameters: {
      type: 'object',
      properties: {
        learningId: { type: 'string', description: 'ID of the course/book' },
        moduleId: { type: 'string', description: 'ID of the module to update' },
        status: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'], description: 'New module status' },
      },
      required: ['learningId', 'moduleId', 'status'],
    },
    execute: async (args, authToken) => {
      const updated = await noxClient.updateLearningModule(args.learningId, args.moduleId, args.status, authToken);
      return { success: true, learningId: args.learningId, moduleId: args.moduleId, status: updated.status };
    },
  },

  // ---- Tasks ----
  {
    name: 'nox_create_task',
    description: 'Create a new actionable task in Nox with an optional priority (LOW, MEDIUM, HIGH, URGENT) and due date.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Actionable title of the task' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Priority level' },
        dueDate: { type: 'string', description: 'ISO date string (e.g. 2026-09-22) when task is due' },
        goalId: { type: 'string', description: 'Optional Goal ID' },
        roadmapId: { type: 'string', description: 'Optional Roadmap ID' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const task = await noxClient.createTask({
        title: args.title,
        priority: args.priority || 'MEDIUM',
        dueDate: args.dueDate,
        goalId: args.goalId,
        roadmapId: args.roadmapId,
      }, authToken);
      return { success: true, taskId: task.id, title: task.title, priority: task.priority };
    },
  },

  {
    name: 'nox_toggle_task',
    description: 'Mark a task as completed or todo.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID of the task to update' },
        status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'COMPLETED'], description: 'New status' },
      },
      required: ['taskId', 'status'],
    },
    execute: async (args, authToken) => {
      const updated = await noxClient.toggleTask(args.taskId, args.status, authToken);
      return { success: true, taskId: updated.id, status: updated.status };
    },
  },

  // ---- Habits ----
  {
    name: 'nox_log_habit',
    description: 'Log completion or check-in for a daily habit.',
    parameters: {
      type: 'object',
      properties: {
        habitId: { type: 'string', description: 'ID of the habit to log' },
        note: { type: 'string', description: 'Optional reflection or check-in note' },
      },
      required: ['habitId'],
    },
    execute: async (args, authToken) => {
      const log = await noxClient.logHabit(args.habitId, 'COMPLETED', args.note, authToken);
      return { success: true, habitId: args.habitId, log };
    },
  },

  // ---- Events ----
  {
    name: 'nox_schedule_event',
    description: 'Schedule a calendar event in Nox.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        date: { type: 'string', description: 'ISO Date string (YYYY-MM-DD)' },
        startTime: { type: 'string', description: 'Start time (e.g. 10:00 AM or 14:30)' },
        endTime: { type: 'string', description: 'End time (e.g. 11:30 AM or 16:00)' },
        location: { type: 'string', description: 'Optional location or link' },
      },
      required: ['title', 'date'],
    },
    execute: async (args, authToken) => {
      const event = await noxClient.createEvent(args, authToken);
      return { success: true, eventId: event.id, title: event.title, date: event.date };
    },
  },

  // ---- Reminders ----
  {
    name: 'nox_create_reminder',
    description: 'Create a timely prompt or reminder in Nox.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What to be reminded about' },
        remindAt: { type: 'string', description: 'ISO timestamp or date string when reminder should trigger' },
      },
      required: ['title', 'remindAt'],
    },
    execute: async (args, authToken) => {
      const reminder = await noxClient.createReminder(args, authToken);
      return { success: true, reminderId: reminder.id, title: reminder.title, remindAt: reminder.remindAt };
    },
  },

  // ---- Notes & Knowledge ----
  {
    name: 'nox_create_note',
    description: 'Quick capture an idea, architectural thought, or note in Nox.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note body content' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const note = await noxClient.createNote(args, authToken);
      return { success: true, noteId: note.id, title: note.title };
    },
  },

  // ---- Search ----
  {
    name: 'nox_search_knowledge',
    description: 'Search across all tasks, goals, roadmaps, learning tracks, and notes in Nox for any query.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or keyword' },
      },
      required: ['query'],
    },
    execute: async (args, authToken) => {
      const results = await noxClient.search(args.query, authToken);
      return results;
    },
  },
];
