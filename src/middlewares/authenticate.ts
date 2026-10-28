import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ROLES, type Role } from '../config/permissions.js';
import { unauthorized } from '../errors/AppError.js';
import * as userRepository from '../modules/user/user.repository.js';

/**
 * Reads Bearer JWT, then reloads the user (and role) from the database.
 * A role change takes effect on the next request even if the token is still valid.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(unauthorized('Missing or invalid Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(unauthorized('Missing or invalid Authorization header'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || decoded.sub === undefined) {
      next(unauthorized('Invalid or expired access token'));
      return;
    }
    const userId = typeof decoded.sub === 'number' ? decoded.sub : Number(decoded.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      next(unauthorized('Invalid or expired access token'));
      return;
    }
    const user = await userRepository.findAuthById(userId);
    if (!user) {
      next(unauthorized('User no longer exists'));
      return;
    }
    if (!ROLES.includes(user.role as Role)) {
      next(unauthorized('User has an unknown role'));
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      studentId: user.studentId,
    };
    next();
  } catch {
    next(unauthorized('Invalid or expired access token'));
  }
};
