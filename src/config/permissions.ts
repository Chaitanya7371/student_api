/**
 * Roles and permissions. Route code must call hasPermission / can / requirePermission.
 * Never write `role === 'teacher'` outside this file.
 */

export const ROLES = ['admin', 'teacher', 'student', 'user', 'moderator'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'students:read:own',
  'students:read:class',
  'students:read:any',
  'students:write:any',
  'marks:read:own',
  'marks:read:class',
  'marks:read:any',
  'marks:write:class',
  'marks:write:any',
  'marks:averages:class',
  'marks:averages:any',
  'admin:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const rolePermissions: Record<Role, readonly Permission[]> = {
  admin: [...PERMISSIONS],
  teacher: [
    'students:read:class',
    'marks:read:class',
    'marks:write:class',
    'marks:averages:class',
  ],
  student: ['students:read:own', 'marks:read:own'],
  user: [],
  moderator: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

/** True when the role has at least one of the listed permissions. */
export function can(role: Role, ...permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * A teacher account has class-scoped student read, and nothing wider.
 * Used when linking teacher_classes — never compare role strings outside this file.
 */
export function isTeacherAccount(role: Role): boolean {
  return (
    hasPermission(role, 'students:read:class') &&
    !hasPermission(role, 'students:read:any') &&
    !hasPermission(role, 'students:read:own')
  );
}

/** A student account has own-scoped read only. */
export function isStudentAccount(role: Role): boolean {
  return (
    hasPermission(role, 'students:read:own') &&
    !hasPermission(role, 'students:read:class') &&
    !hasPermission(role, 'students:read:any')
  );
}
