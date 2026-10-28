import type { RequestHandler } from 'express';
import { badRequest } from '../errors/AppError.js';

const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Walk a JSON body and reject keys that are used for prototype pollution.
 * This runs before validation and before any repository call.
 */
function findBlockedKey(value: unknown, path: string): string | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const childPath = path ? `${path}.${index}` : String(index);
      const found = findBlockedKey(value[index], childPath);
      if (found) return found;
    }
    return undefined;
  }

  if (!value || typeof value !== 'object') return undefined;

  for (const key of Object.keys(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (blockedKeys.has(key)) return childPath;
    const found = findBlockedKey((value as Record<string, unknown>)[key], childPath);
    if (found) return found;
  }

  return undefined;
}

export const rejectDangerousPayload: RequestHandler = (req, _res, next) => {
  const field = findBlockedKey(req.body, '');
  if (!field) {
    next();
    return;
  }

  const fieldErrors: Record<string, string[]> = Object.create(null);
  fieldErrors[field] = ['is not allowed'];
  next(badRequest('Rejected dangerous payload', { fieldErrors }));
};
