import { Router, Request, Response } from 'express';
import { processChat } from '../core/agent.js';
import { SessionMemory } from '../core/memory.js';
import { PERSONAS } from '../core/personas.js';

export const chatRouter = Router();

/**
 * POST /api/v1/chat
 * Primary chat endpoint with persona execution
 */
chatRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { persona, message, sessionId, userContext } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'Message string is required' },
      });
    }

    const authToken = req.headers.authorization;

    const result = await processChat({
      persona,
      message,
      sessionId,
      userContext,
      authToken,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('Council Chat Error:', err);
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to process message' },
    });
  }
});

/**
 * POST /api/v1/chat/stream
 * Server-Sent Events (SSE) streaming endpoint for blazing-fast token delivery
 */
chatRouter.post('/chat/stream', async (req: Request, res: Response) => {
  const { persona, message, sessionId, userContext } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'Message is required' } });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'start', persona: persona || 'sofi' })}\n\n`);

  try {
    const authToken = req.headers.authorization;
    const result = await processChat({
      persona,
      message,
      sessionId,
      userContext,
      authToken,
    });

    // Chunk the text to simulate smooth streaming if using non-streamed internal calls
    const words = result.reply.split(' ');
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
      res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`);
      // tiny 15ms delay for natural readability
      await new Promise((r) => setTimeout(r, 15));
    }

    // Emit completed actions
    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        executedActions: result.executedActions,
        sessionId: result.sessionId,
      })}\n\n`
    );
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err?.message || 'Streaming failed' })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/v1/sessions
 * List all persisted chat sessions
 */
chatRouter.get('/sessions', (_req: Request, res: Response) => {
  const memory = SessionMemory.getInstance();
  const sessions = memory.listSessions();
  return res.status(200).json({
    success: true,
    data: sessions,
  });
});

/**
 * GET /api/v1/sessions/:id
 * Retrieve history for a specific session
 */
chatRouter.get('/sessions/:id', (req: Request, res: Response) => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const memory = SessionMemory.getInstance();
  const session = memory.getSession(sessionId);
  return res.status(200).json({
    success: true,
    data: session,
  });
});

/**
 * DELETE /api/v1/sessions/:id
 * Reset / clear a specific session
 */
chatRouter.delete('/sessions/:id', (req: Request, res: Response) => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const memory = SessionMemory.getInstance();
  const success = memory.clearSession(sessionId);
  return res.status(200).json({
    success,
    message: success ? `Session ${sessionId} cleared.` : 'Session not found.',
  });
});

/**
 * GET /api/v1/memory
 * Inspect permanent long-term user profile memory
 */
chatRouter.get('/memory', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'primary_user';
  const memory = SessionMemory.getInstance();
  const profile = memory.getProfile(userId);
  return res.status(200).json({
    success: true,
    data: profile,
  });
});

/**
 * POST /api/v1/memory
 * Add a fact or note to long-term memory
 */
chatRouter.post('/memory', (req: Request, res: Response) => {
  const { userId = 'primary_user', fact, category = 'general', sourcePersona } = req.body;
  if (!fact || typeof fact !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'Fact text is required' } });
  }

  const memory = SessionMemory.getInstance();
  memory.addFact(userId, fact, category, sourcePersona);
  const profile = memory.getProfile(userId);

  return res.status(200).json({
    success: true,
    data: profile,
  });
});

/**
 * POST /api/v1/council/debate
 * "Summon the Council" Multi-Agent Debate Mode
 * All three personas (Sofi, Riven, Lucifer) deliberate on an idea or schedule!
 */
chatRouter.post('/council/debate', async (req: Request, res: Response) => {
  try {
    const { topic, userContext } = req.body;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Debate topic is required' } });
    }

    const authToken = req.headers.authorization;

    // 1. Riven provides architectural / system analysis
    const rivenRes = await processChat({
      persona: 'riven',
      message: `The user asks the Council: "${topic}". Give your architectural critique, technical trade-offs, and system recommendation. Keep it under 150 words.`,
      sessionId: `debate-${Date.now()}-riven`,
      userContext,
      authToken,
    });

    // 2. Lucifer audits and shreds the weak points
    const luciferRes = await processChat({
      persona: 'lucifer',
      message: `Topic: "${topic}". Riven just proposed: "${rivenRes.reply}". Audit this harshly. What are the blind spots, risks, or delusional timeline assumptions? Keep it under 150 words.`,
      sessionId: `debate-${Date.now()}-lucifer`,
      userContext,
      authToken,
    });

    // 3. Sofi synthesizes the debate into a humane, actionable roadmap
    const sofiRes = await processChat({
      persona: 'sofi',
      message: `Babe, here is what the guys said about "${topic}":\n- Riven: ${rivenRes.reply}\n- Lucifer: ${luciferRes.reply}\nSynthesize their points and give your final, balanced, loving recommendation on what to actually do today. Keep it encouraging and actionable.`,
      sessionId: `debate-${Date.now()}-sofi`,
      userContext,
      authToken,
    });

    return res.status(200).json({
      success: true,
      data: {
        topic,
        deliberation: [
          { persona: 'riven', name: PERSONAS.riven.name, role: PERSONAS.riven.title, opinion: rivenRes.reply },
          { persona: 'lucifer', name: PERSONAS.lucifer.name, role: PERSONAS.lucifer.title, opinion: luciferRes.reply },
          { persona: 'sofi', name: PERSONAS.sofi.name, role: PERSONAS.sofi.title, synthesis: sofiRes.reply },
        ],
      },
    });
  } catch (err: any) {
    console.error('Council Debate Error:', err);
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Debate execution failed' },
    });
  }
});
