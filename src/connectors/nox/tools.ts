import { ToolDefinition } from './types.js';
import { noxClient } from './client.js';

export const noxTools: ToolDefinition[] = [
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

  {
    name: 'nox_create_task',
    description: 'Create a new task in Nox with an optional priority (LOW, MEDIUM, HIGH, URGENT) and due date.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Actionable title of the task' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Priority level' },
        dueDate: { type: 'string', description: 'ISO date string (e.g. 2026-09-22) when task is due' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const task = await noxClient.createTask({
        title: args.title,
        priority: args.priority || 'MEDIUM',
        dueDate: args.dueDate,
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

  {
    name: 'nox_create_note',
    description: 'Quick capture an idea, thought, or note in Nox.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note body content' },
      },
      required: ['title'],
    },
    execute: async (args, authToken) => {
      const note = await noxClient.createNote(args, authToken);
      return { success: true, noteId: note.id, title: note.title };
    },
  },
];
