import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

/** Reflect an allowed Origin, or omit CORS headers when the Origin is not listed. */
export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && env.CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
};
