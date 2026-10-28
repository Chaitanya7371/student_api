import type { AuthUser } from '../modules/auth/auth.interface.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
    interface Locals {
      curl?: string;
    }
  }
}

export {};
