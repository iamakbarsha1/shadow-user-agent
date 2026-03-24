import { prisma } from '../client';
import crypto from 'crypto';

/**
 * Database queries for api_keys table
 */

/**
 * Generates a cryptographically secure API key string
 */
export function generateApiKeyString(): string {
  return `sk_shadow_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Creates and stores a new API key
 */
export async function createApiKey(label: string) {
  const key = generateApiKeyString();
  const record = await prisma.apiKey.create({
    data: { key, label },
  });
  return { ...record, key }; // return plain key once (unhashed)
}

/**
 * Finds an API key record by the key string
 */
export async function findApiKeyByValue(key: string) {
  return await prisma.apiKey.findUnique({
    where: { key },
  });
}

/**
 * Lists all API keys (without the key value for security)
 */
export async function listApiKeys() {
  return await prisma.apiKey.findMany({
    select: { id: true, label: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Deletes an API key by ID
 */
export async function deleteApiKey(id: string) {
  return await prisma.apiKey.delete({ where: { id } });
}
