import { PrismaClient } from '@prisma/client';

export type AuditAction =
  | 'BOT_CREATED'
  | 'BOT_UPDATED'
  | 'BOT_DELETED'
  | 'BOT_DUPLICATED'
  | 'BOT_ARCHIVED'
  | 'CREDENTIAL_ADDED'
  | 'CREDENTIAL_TESTED'
  | 'CREDENTIAL_UPDATED'
  | 'CREDENTIAL_DELETED'
  | 'TOOL_EXECUTED'
  | 'MEMORY_CREATED'
  | 'MEMORY_DELETED'
  | 'INTEGRATION_CONNECTED'
  | 'INTEGRATION_UPDATED';

export type EntityType = 'BOT' | 'CREDENTIAL' | 'TOOL' | 'MEMORY' | 'INTEGRATION' | 'CONVERSATION';

export interface AuditEntry {
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Sanitizes details to guarantee that no API keys, tokens, or raw secrets are ever recorded in audit logs.
 */
function sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
  if (!details) return undefined;
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('key') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('auth')
    ) {
      sanitized[key] = '[REDACTED_SECRET]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Records an audit log entry. Non-blocking to avoid interrupting business operations.
 */
export async function logAudit(prisma: PrismaClient, entry: AuditEntry): Promise<void> {
  try {
    const cleanDetails = sanitizeDetails(entry.details);
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        details: cleanDetails ?? {},
        ipAddress: entry.ipAddress,
      },
    });
  } catch (err: any) {
    // Non-blocking log warning
    console.warn(`[AuditLog] Failed to record audit log (${entry.action}):`, err?.message);
  }
}
