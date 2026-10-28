const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;

/** PostgreSQL unique_violation (duplicate roll number, or duplicate exam subject). */
export const isUniqueViolation = (error: unknown): boolean => codeOf(error) === '23505';

/** PostgreSQL foreign_key_violation (marks saved for a student id that does not exist). */
export const isForeignKeyViolation = (error: unknown): boolean => codeOf(error) === '23503';
