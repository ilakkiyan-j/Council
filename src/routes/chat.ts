import { Router, Request, Response } from 'express';
import { processChat } from '../core/agent.js';

export const chatRouter = Router();

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
