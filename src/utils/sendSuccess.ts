import type { Response } from 'express';

/**
 * Every successful module response goes through here.
 * Shape: { "data": ... , "curl"?: "..." }. 204 has no body.
 */
export function sendSuccess(res: Response, data: unknown, status = 200): void {
  if (status === 204) {
    res.status(204).end();
    return;
  }

  const body: { data: unknown; curl?: string } = { data };
  if (typeof res.locals.curl === 'string') body.curl = res.locals.curl;
  res.status(status).json(body);
}
