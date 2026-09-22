import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for credential operations to prevent brute-force attacks or provider abuse
 */
export const credentialRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP / user to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    error: {
      message: 'Too many credential requests. Please wait a few minutes before trying again.',
    },
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip || 'anonymous';
  },
});

/**
 * Rate limiter for AI chat generation endpoints to avoid runaway generation
 */
export const chatRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    error: {
      message: 'Generation rate limit exceeded. Please slow down your requests.',
    },
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip || 'anonymous';
  },
});
