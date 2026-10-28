import { hasPermission } from '../../config/permissions.js';
import type { AuthUser } from '../auth/auth.interface.js';
import * as accessRepository from './access.repository.js';

interface StudentScope {
  id: number;
  className: string;
  section: string;
}

/**
 * One helper for every student / marks service call.
 * Checks permissions first, then ownership / class scope through repositories (no SQL here).
 */
export async function canAccessStudent(
  actor: AuthUser,
  student: StudentScope,
  action: 'read' | 'write',
): Promise<boolean> {
  if (action === 'read') {
    if (hasPermission(actor.role, 'students:read:any') || hasPermission(actor.role, 'marks:read:any')) {
      return true;
    }

    if (hasPermission(actor.role, 'students:read:class') || hasPermission(actor.role, 'marks:read:class')) {
      const classes = await accessRepository.findClassesForTeacher(actor.id);
      if (classes.some((item) => item.className === student.className && item.section === student.section)) {
        return true;
      }
    }

    if (hasPermission(actor.role, 'students:read:own') || hasPermission(actor.role, 'marks:read:own')) {
      return actor.studentId === student.id;
    }

    return false;
  }

  // write
  if (hasPermission(actor.role, 'students:write:any') || hasPermission(actor.role, 'marks:write:any')) {
    return true;
  }

  if (hasPermission(actor.role, 'marks:write:class')) {
    const classes = await accessRepository.findClassesForTeacher(actor.id);
    return classes.some((item) => item.className === student.className && item.section === student.section);
  }

  return false;
}
