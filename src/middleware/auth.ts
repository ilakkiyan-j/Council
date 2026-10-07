import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface CouncilUser {
  id: string;
  email?: string;
  name: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: CouncilUser;
    }
  }
}

function getCandidateSecrets(): string[] {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  const secrets: string[] = [];
  if (configuredSecret) secrets.push(configuredSecret);
  if (process.env.NODE_ENV !== 'production') {
    secrets.push('council-jwt-secret-dev');
    secrets.push('nox_local_dev_jwt_secret_98234710928340192834');
    secrets.push('test-secret-that-is-longer-than-32-characters-long');
  }
  return Array.from(new Set(secrets));
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && typeof header === 'string') {
    const [scheme, token] = header.split(' ');
    if (scheme === 'Bearer' && token && token.trim().length > 0) return token.trim();
  }
  // Allow passing token via query param (e.g. embed views and SSE streams)
  if (req.query?.token && typeof req.query.token === 'string' && req.query.token.trim().length > 0) {
    return req.query.token.trim();
  }
  return null;
}

/**
 * Resolves the authenticated user.
 * Dynamically verifies JWT tokens with Nox's JWT_SECRET.
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  const headerUserId = req.headers['x-user-id'];
  const requestedUserId = typeof headerUserId === 'string' ? headerUserId.trim() : '';

  if (token) {
    const candidateSecrets = getCandidateSecrets();
    if (candidateSecrets.length === 0) {
      return res.status(503).json({
        success: false,
        error: { message: 'Council authentication is not configured.' },
      });
    }

    let verifiedDecoded: jwt.JwtPayload | null = null;
    let verifyError: unknown = null;

    for (const s of candidateSecrets) {
      try {
        const decoded = jwt.verify(token, s, { algorithms: ['HS256'] });
        if (typeof decoded === 'object' && decoded !== null) {
          verifiedDecoded = decoded as jwt.JwtPayload;
          break;
        }
      } catch (err) {
        verifyError = err;
      }
    }

    if (!verifiedDecoded) {
      // In development, if headerUserId was provided by Nox proxy, allow local dev fallback
      if (process.env.NODE_ENV !== 'production' && requestedUserId) {
        req.user = {
          id: requestedUserId,
          name: 'User ' + requestedUserId.slice(-4),
          role: 'USER',
        };
        return next();
      }

      const isExpired = (verifyError as any)?.name === 'TokenExpiredError';
      return res.status(401).json({
        success: false,
        error: {
          message: isExpired
            ? 'Council session token has expired. Please refresh your session.'
            : 'Council token verification failed: invalid signature or expired token.',
        },
      });
    }

    const userId =
      typeof verifiedDecoded.sub === 'string' && verifiedDecoded.sub.trim()
        ? verifiedDecoded.sub.trim()
        : typeof (verifiedDecoded as any).userId === 'string' && (verifiedDecoded as any).userId.trim()
        ? (verifiedDecoded as any).userId.trim()
        : typeof (verifiedDecoded as any).id === 'string' && (verifiedDecoded as any).id.trim()
        ? (verifiedDecoded as any).id.trim()
        : '';

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Council token does not contain a valid user identity.' },
      });
    }

    req.user = {
      id: userId,
      email: typeof verifiedDecoded.email === 'string' ? verifiedDecoded.email : undefined,
      name: typeof verifiedDecoded.name === 'string' ? verifiedDecoded.name : 'Council User',
      role: typeof verifiedDecoded.role === 'string' ? verifiedDecoded.role : 'USER',
    };
    return next();
  }

  if (process.env.NODE_ENV !== 'production' && requestedUserId) {
    req.user = {
      id: requestedUserId,
      name: 'User ' + requestedUserId.slice(-4),
      role: 'USER',
    };
    return next();
  }

  return res.status(401).json({
    success: false,
    error: { message: 'Authentication required. Provide a valid bearer token.' },
  });
}

/**
 * Strict authentication guard
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required. You must be signed in.' },
    });
  }
  return next();
}
