import type { RequestHandler } from 'express';
import { can, type Permission } from '../config/permissions.js';
import { forbidden, unauthorized } from '../errors/AppError.js';

/**
 * Route-level permission check. Use permissions, never role names.
 * Example: requirePermission('students:write:any')
 */
export const requirePermission =
  (...permissions: Permission[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!can(req.user.role, ...permissions)) {
      next(forbidden('You do not have permission for this action'));
      return;
    }
    next();
  };
