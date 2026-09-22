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

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'council-jwt-secret-dev';
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token || token.trim().length === 0) return null;
  return token.trim();
}

/**
 * Resolves the authenticated user.
 * Dynamically verifies JWT tokens with Nox's JWT_SECRET.
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);

  if (token) {
    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret) as any;
      const userId = decoded.sub || decoded.id || decoded.userId;
      if (userId) {
        req.user = {
          id: userId,
          email: decoded.email,
          name: decoded.name || 'Council User',
          role: decoded.role || 'USER',
        };
        return next();
      }
    } catch (err: any) {
      console.warn('[Council Auth] Token verification notice:', err?.message);
      // In production, return 401 if a token was provided but invalid
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          success: false,
          error: { message: `Council token verification failed: ${err?.message}` },
        });
      }
    }
  }

  // Development convenience or explicit user ID header
  const requestedUserId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
  if (requestedUserId) {
    req.user = {
      id: requestedUserId,
      name: 'User ' + requestedUserId.slice(-4),
      role: 'USER',
    };
    return next();
  }

  if (process.env.NODE_ENV === 'production') {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required. Authorization header missing.' },
    });
  }

  // Default fallback user for seamless local standalone operation
  req.user = {
    id: 'cmttwn1zg0000h4iajwvjrlf0', // Ilakkiyan J / primary user
    email: 'ilakkiyan-j@arixen.in',
    name: 'Ilakkiyan J',
    role: 'USER',
  };
  return next();
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
