import type { ErrorRequestHandler } from 'express';
import { ZodError, z } from 'zod';
import { isProduction } from '../config/env.js';
import { isAppError } from '../errors/AppError.js';


export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (isAppError(err)) {
    const body: { error: { message: string; details?: unknown }; curl?: string } = {
      error: { message: err.message, details: err.details },
    };
    if (typeof res.locals.curl === 'string') body.curl = res.locals.curl;
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    const add = (field: string, message: string) => {
      const messages = fieldErrors[field] ?? [];
      messages.push(message);
      fieldErrors[field] = messages;
    };

    for (const issue of err.issues) {
      const base = issue.path.map(String).join('.');
      // strictObject reports extra keys (id, createdAt, ...) in issue.keys, not in the path.
      if (issue.code === 'unrecognized_keys') {
        for (const key of issue.keys) add(base ? `${base}.${key}` : key, issue.message);
        continue;
      }
      add(base || 'body', issue.message);
    }
    res.status(400).json({
      error: { message: 'Validation failed', details: { ...z.flattenError(err), fieldErrors } },
    });
    return;
  }

  // Malformed JSON body from express.json()
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'Malformed JSON body' } });
    return;
  }

  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { message: 'Payload too large', details: { fieldErrors: { body: ['payload too large'] } } } });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { message: isProduction ? 'Internal Server Error' : (err as Error).message },
  });
};
