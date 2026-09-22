import { config } from '../../config.js';

export class NoxClient {
  private baseUrl: string;

  constructor(baseUrl: string = config.noxApiUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}, authToken?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (authToken) {
      headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const json: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMsg = json?.error?.message || json?.message || `Nox API responded with HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    return (json?.data !== undefined ? json.data : json) as T;
  }

  // ---- Dashboard Summary ----------------------------------------------------
  async getDashboard(authToken?: string) {
    return this.request('/api/v1/dashboard', { method: 'GET' }, authToken);
  }

  // ---- Goals ----------------------------------------------------------------
  async getGoals(authToken?: string) {
    return this.request('/api/v1/goals', { method: 'GET' }, authToken);
  }

  async createGoal(data: { title: string; description?: string; targetDate?: string; status?: string }, authToken?: string) {
    return this.request('/api/v1/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    }, authToken);
  }

  // ---- Roadmaps & Milestones ------------------------------------------------
  async getRoadmaps(authToken?: string) {
    return this.request('/api/v1/roadmaps', { method: 'GET' }, authToken);
  }

  async createRoadmap(data: { goalId?: string; title: string; description?: string }, authToken?: string) {
    return this.request('/api/v1/roadmaps', {
      method: 'POST',
      body: JSON.stringify(data),
    }, authToken);
  }

  async createMilestone(roadmapId: string, data: { title: string; description?: string; targetDate?: string; order?: number }, authToken?: string) {
    return this.request(`/api/v1/roadmaps/${roadmapId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, authToken);
  }

  // ---- Learning Paths & Courses ---------------------------------------------
  async getLearning(authToken?: string) {
    return this.request('/api/v1/learning', { method: 'GET' }, authToken);
  }

  async createLearning(data: { title: string; description?: string; type?: string; url?: string; goalId?: string; roadmapId?: string; modules?: string[] }, authToken?: string) {
    return this.request('/api/v1/learning', {
      method: 'POST',
      body: JSON.stringify(data),
    }, authToken);
  }

  async updateLearningModule(learningId: string, moduleId: string, status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED', authToken?: string) {
    return this.request(`/api/v1/learning/${learningId}/modules/${moduleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, authToken);
  }

  // ---- Tasks ----------------------------------------------------------------
  async getTasks(authToken?: string) {
    return this.request('/api/v1/tasks', { method: 'GET' }, authToken);
  }

  async createTask(data: {
    title: string;
    priority?: string;
    dueDate?: string;
    goalId?: string;
    roadmapId?: string;
    milestoneId?: string;
    learningId?: string;
    eventId?: string;
  }, authToken?: string) {
    return this.request('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }, authToken);
  }

  async toggleTask(taskId: string, status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED', authToken?: string) {
    return this.request(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, authToken);
  }

  // ---- Habits ---------------------------------------------------------------
  async getHabits(authToken?: string) {
    return this.request('/api/v1/habits', { method: 'GET' }, authToken);
  }

  async logHabit(habitId: string, status: 'COMPLETED' | 'MISSED' | 'SKIPPED' = 'COMPLETED', note?: string, authToken?: string) {
    return this.request(`/api/v1/habits/${habitId}/log`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    }, authToken);
  }

  // ---- Events ---------------------------------------------------------------
  async getEvents(authToken?: string) {
    return this.request('/api/v1/events', { method: 'GET' }, authToken);
  }

  async createEvent(data: { title: string; date: string; startTime?: string; endTime?: string; location?: string; goalId?: string }, authToken?: string) {
    return this.request('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }, authToken);
  }

  // ---- Reminders ------------------------------------------------------------
  async getReminders(authToken?: string) {
    return this.request('/api/v1/reminders', { method: 'GET' }, authToken);
  }

  async createReminder(data: { title: string; remindAt: string; entityType?: string; entityId?: string }, authToken?: string) {
    return this.request('/api/v1/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    }, authToken);
  }

  // ---- Notes & Knowledge ----------------------------------------------------
  async getNotes(authToken?: string) {
    return this.request('/api/v1/notes', { method: 'GET' }, authToken);
  }

  async createNote(data: { title: string; content?: string; tags?: string[]; goalId?: string; taskId?: string }, authToken?: string) {
    return this.request('/api/v1/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }, authToken);
  }

  // ---- Global Search --------------------------------------------------------
  async search(query: string, authToken?: string) {
    return this.request(`/api/v1/search?q=${encodeURIComponent(query)}`, { method: 'GET' }, authToken);
  }
}

export const noxClient = new NoxClient();
