import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { CredentialService } from '../services/credentialService.js';
import { requireAuth } from '../middleware/auth.js';
import { credentialRateLimiter } from '../middleware/rateLimit.js';

export const credentialsRouter = Router();
const credentialService = new CredentialService(prisma);

/**
 * GET /api/v1/provider-credentials
 * List all connected provider credentials for the authenticated user.
 * Returns only masked keys and metadata — NEVER raw secrets.
 */
credentialsRouter.get('/provider-credentials', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const creds = await credentialService.listCredentials(userId);
    return res.status(200).json({ success: true, data: creds });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err?.message || 'Failed to list credentials' } });
  }
});

/**
 * POST /api/v1/provider-credentials
 * Validate, encrypt, and securely store a new provider credential.
 * Rate limited to prevent brute force testing.
 */
credentialsRouter.post(
  '/provider-credentials',
  requireAuth,
  credentialRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { provider, label, apiKey, customEndpoint } = req.body;

      if (!provider || typeof provider !== 'string') {
        return res.status(400).json({ success: false, error: { message: 'Provider type is required.' } });
      }
      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ success: false, error: { message: 'API key is required.' } });
      }

      const result = await credentialService.addCredential(
        userId,
        {
          provider,
          label: label || `${provider} Key`,
          apiKey,
          customEndpoint,
        },
        req.ip
      );

      return res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to store credential' } });
    }
  }
);

/**
 * POST /api/v1/provider-credentials/:id/test
 * Test connectivity for an existing credential.
 */
credentialsRouter.post(
  '/provider-credentials/:id/test',
  requireAuth,
  credentialRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const credId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await credentialService.testCredential(userId, credId, req.ip);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: { message: err?.message || 'Credential test failed' } });
    }
  }
);

/**
 * DELETE /api/v1/provider-credentials/:id
 * Remove a provider credential.
 */
credentialsRouter.delete(
  '/provider-credentials/:id',
  requireAuth,
  credentialRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const credId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await credentialService.deleteCredential(userId, credId, req.ip);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: { message: err?.message || 'Failed to delete credential' } });
    }
  }
);
