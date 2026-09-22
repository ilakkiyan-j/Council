import { PrismaClient } from '@prisma/client';
import { encryptCredential, decryptCredential, maskKey, generateKeyFingerprint } from '../security/encryption.js';
import { ModelRouter } from '../providers/router.js';
import { logAudit } from '../security/audit.js';

export interface AddCredentialInput {
  provider: string; // gemini, openai, groq, anthropic, ollama
  label: string;
  apiKey: string;
  customEndpoint?: string;
}

export class CredentialService {
  constructor(private prisma: PrismaClient) {}

  async listCredentials(userId: string) {
    const creds = await this.prisma.providerCredential.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        label: true,
        keyFingerprint: true,
        status: true,
        lastValidatedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { botConfigs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format safe view with masked fingerprint prefix
    return creds.map((c) => ({
      ...c,
      maskedKey: `••••••••••••${c.keyFingerprint.slice(0, 4).toUpperCase()}`,
      activeBotsCount: c._count.botConfigs,
    }));
  }

  async addCredential(userId: string, input: AddCredentialInput, ipAddress?: string) {
    const trimmedKey = input.apiKey.trim();
    if (!trimmedKey) {
      throw new Error('API key cannot be empty.');
    }

    const providerId = input.provider.toLowerCase();
    const router = ModelRouter.getInstance();
    const adapter = router.getAdapter(providerId);

    // 1. Backend validates the provider credential before storage
    const validation = await adapter.validateCredential(trimmedKey, input.customEndpoint);
    if (!validation.valid) {
      throw new Error(`Credential validation failed: ${validation.error || 'Invalid API key.'}`);
    }

    // 2. Encrypt using AES-256-GCM
    const encrypted = encryptCredential(trimmedKey);

    // 3. Upsert or create
    const credential = await this.prisma.providerCredential.upsert({
      where: {
        userId_provider_keyFingerprint: {
          userId,
          provider: providerId,
          keyFingerprint: encrypted.keyFingerprint,
        },
      },
      update: {
        label: input.label || `${adapter.name} Credential`,
        encryptedSecret: encrypted.encryptedSecret,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        status: 'ACTIVE',
        lastValidatedAt: new Date(),
      },
      create: {
        userId,
        provider: providerId,
        label: input.label || `${adapter.name} Credential`,
        encryptedSecret: encrypted.encryptedSecret,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyFingerprint: encrypted.keyFingerprint,
        status: 'ACTIVE',
        lastValidatedAt: new Date(),
      },
    });

    await logAudit(this.prisma, {
      userId,
      action: 'CREDENTIAL_ADDED',
      entityType: 'CREDENTIAL',
      entityId: credential.id,
      details: { provider: providerId, label: credential.label },
      ipAddress,
    });

    // Return safe masked metadata only — NEVER raw API key!
    return {
      id: credential.id,
      provider: credential.provider,
      label: credential.label,
      maskedKey: encrypted.maskedDisplay,
      status: credential.status,
      lastValidatedAt: credential.lastValidatedAt,
    };
  }

  async testCredential(userId: string, credentialId: string, ipAddress?: string) {
    const cred = await this.prisma.providerCredential.findFirst({
      where: { id: credentialId, userId },
    });

    if (!cred) {
      throw new Error(`Credential not found or unauthorized.`);
    }

    let decryptedKey: string;
    try {
      decryptedKey = decryptCredential(cred.encryptedSecret, cred.iv, cred.authTag);
    } catch (err: any) {
      await this.prisma.providerCredential.update({
        where: { id: credentialId },
        data: { status: 'INVALID' },
      });
      throw new Error('Credential decryption failed. The master key may have rotated.');
    }

    const router = ModelRouter.getInstance();
    const adapter = router.getAdapter(cred.provider);
    const validation = await adapter.validateCredential(decryptedKey);

    const newStatus = validation.valid ? 'ACTIVE' : 'INVALID';
    await this.prisma.providerCredential.update({
      where: { id: credentialId },
      data: {
        status: newStatus,
        lastValidatedAt: new Date(),
      },
    });

    await logAudit(this.prisma, {
      userId,
      action: 'CREDENTIAL_TESTED',
      entityType: 'CREDENTIAL',
      entityId: credentialId,
      details: { provider: cred.provider, valid: validation.valid },
      ipAddress,
    });

    return {
      id: cred.id,
      valid: validation.valid,
      status: newStatus,
      error: validation.error,
      lastValidatedAt: new Date(),
    };
  }

  async deleteCredential(userId: string, credentialId: string, ipAddress?: string) {
    const cred = await this.prisma.providerCredential.findFirst({
      where: { id: credentialId, userId },
    });

    if (!cred) {
      throw new Error(`Credential not found or unauthorized.`);
    }

    await this.prisma.providerCredential.delete({
      where: { id: credentialId },
    });

    await logAudit(this.prisma, {
      userId,
      action: 'CREDENTIAL_DELETED',
      entityType: 'CREDENTIAL',
      entityId: credentialId,
      details: { provider: cred.provider, label: cred.label },
      ipAddress,
    });

    return { success: true, message: 'Provider credential removed successfully.' };
  }
}
