import type { RequestHandler } from 'express';

/** Personal data must not be stored by browsers or shared caches. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
