import type { RequestHandler } from 'express';

/**
 * Builds a safe curl example for the response.
 * Authorization and password fields are redacted so secrets never leave the server.
 */
export const curlResponse: RequestHandler = (req, res, next) => {
  const method = req.method.toUpperCase();
  const path = req.originalUrl || req.url;
  const parts = [`curl -X ${method} 'http://localhost:${req.socket.localPort ?? 3000}${path}'`];

  if (req.headers.authorization) {
    parts.push(`-H 'Authorization: Bearer [REDACTED]'`);
  }
  if (req.headers['content-type']) {
    parts.push(`-H 'Content-Type: application/json'`);
  }

  if (req.body && typeof req.body === 'object' && Object.keys(req.body as object).length > 0) {
    const safe = redactSecrets({ ...(req.body as Record<string, unknown>) });
    parts.push(`-d '${JSON.stringify(safe)}'`);
  }

  res.locals.curl = parts.join(' ');
  next();
};

function redactSecrets(value: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/password|secret|token|hash/i.test(key)) {
      copy[key] = '[REDACTED]';
    } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      copy[key] = redactSecrets(entry as Record<string, unknown>);
    } else {
      copy[key] = entry;
    }
  }
  return copy;
}
