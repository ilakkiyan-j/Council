import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { authenticateUser } from '../src/middleware/auth.js';
import { ConversationService } from '../src/services/conversationService.js';
import { MemoryService } from '../src/services/memoryService.js';
import { encryptCredential, decryptCredential } from '../src/security/encryption.js';
import { VoiceService } from '../src/services/voiceService.js';

const secret = 'council-auth-test-secret-with-more-than-32-characters';

async function authenticate(options: {
  authorization?: string;
  userId?: string;
  environment?: string;
  jwtSecret?: string;
}) {
  process.env.NODE_ENV = options.environment ?? 'production';
  if (options.jwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = options.jwtSecret;
  }

  let statusCode = 200;
  let responseBody: unknown;
  let continued = false;
  const req = {
    headers: {
      ...(options.authorization ? { authorization: options.authorization } : {}),
      ...(options.userId ? { 'x-user-id': options.userId } : {}),
    },
    query: {},
  } as Request;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;
  const next: NextFunction = () => {
    continued = true;
  };

  await authenticateUser(req, response, next);
  return { statusCode, responseBody, continued, user: req.user };
}

test('production rejects a forged bearer token even when X-User-Id is supplied', async () => {
  const forgedToken = jwt.sign({ sub: 'attacker' }, 'attacker-controlled-secret');
  const result = await authenticate({
    authorization: `Bearer ${forgedToken}`,
    userId: 'victim-account',
    jwtSecret: secret,
  });

  assert.equal(result.statusCode, 401);
  assert.equal(result.continued, false);
  assert.equal(result.user, undefined);
});

test('production never accepts X-User-Id as authentication by itself', async () => {
  const result = await authenticate({ userId: 'victim-account', jwtSecret: secret });

  assert.equal(result.statusCode, 401);
  assert.equal(result.continued, false);
  assert.equal(result.user, undefined);
});

test('production accepts a valid Nox HS256 bearer token', async () => {
  const token = jwt.sign({ sub: 'user-123', role: 'USER', name: 'Test User' }, secret, { algorithm: 'HS256' });
  const result = await authenticate({ authorization: `Bearer ${token}`, jwtSecret: secret });

  assert.equal(result.statusCode, 200);
  assert.equal(result.continued, true);
  assert.equal(result.user?.id, 'user-123');
  assert.equal(result.user?.name, 'Test User');
});

test('production fails closed when its JWT secret is not configured', async () => {
  const token = jwt.sign({ sub: 'user-123' }, secret);
  const result = await authenticate({ authorization: `Bearer ${token}` });

  assert.equal(result.statusCode, 503);
  assert.equal(result.continued, false);
});

test('memory lookup never falls back to another user when this user has no memories', async () => {
  let query: { where: { userId: string } } | undefined;
  const prisma = {
    memory: {
      findMany: async (args: { where: { userId: string } }) => {
        query = args;
        return [];
      },
    },
  } as unknown as PrismaClient;

  const memories = await new MemoryService(prisma).listMemories('user-without-memories');

  assert.deepEqual(memories, []);
  assert.deepEqual(query?.where, { userId: 'user-without-memories' });
});

test('conversation lookup never falls back to another user when this user has no conversations', async () => {
  let query: { where: { userId: string } } | undefined;
  const prisma = {
    conversation: {
      findMany: async (args: { where: { userId: string } }) => {
        query = args;
        return [];
      },
    },
  } as unknown as PrismaClient;

  const conversations = await new ConversationService(prisma).listConversations('user-without-conversations');

  assert.deepEqual(conversations, []);
  assert.equal(query?.where.userId, 'user-without-conversations');
});

test('exclusive voice access is granted only to the exact configured owner ID', () => {
  const previousOwnerId = process.env.OWNER_USER_ID;
  process.env.OWNER_USER_ID = 'owner-user-123';
  try {
    const voiceService = Object.create(VoiceService.prototype) as VoiceService;
    assert.equal(voiceService.isOwnerOrExclusiveAuthorized('owner-user-123'), true);
    assert.equal(voiceService.isOwnerOrExclusiveAuthorized('other-owner-user-123'), false);
    assert.equal(voiceService.isOwnerOrExclusiveAuthorized('user_123'), false);
  } finally {
    if (previousOwnerId === undefined) delete process.env.OWNER_USER_ID;
    else process.env.OWNER_USER_ID = previousOwnerId;
  }
});

test('provider credential encryption fails closed without a configured secret', () => {
  const previousEncryptionKey = process.env.ENCRYPTION_KEY;
  const previousJwtSecret = process.env.JWT_SECRET;
  delete process.env.ENCRYPTION_KEY;
  delete process.env.JWT_SECRET;
  try {
    assert.throws(
      () => encryptCredential('provider-key'),
      /ENCRYPTION_KEY or JWT_SECRET must be configured/,
    );
  } finally {
    if (previousEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previousEncryptionKey;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  }
});

test('provider credential encryption and decryption use the configured key', () => {
  const previousEncryptionKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = 'test-encryption-key';
  try {
    const encrypted = encryptCredential('provider-key');
    assert.equal(
      decryptCredential(encrypted.encryptedSecret, encrypted.iv, encrypted.authTag),
      'provider-key',
    );
  } finally {
    if (previousEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previousEncryptionKey;
  }
});
