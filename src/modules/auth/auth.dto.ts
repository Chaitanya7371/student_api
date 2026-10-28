import { z } from 'zod';
import type { Role } from '../../config/permissions.js';
import { personName } from '../../utils/validators.js';

export const registerDto = z.strictObject({
  name: personName,
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, 'password must be at least 8 characters').max(72),
});
export type RegisterDto = z.infer<typeof registerDto>;

export const loginDto = z.strictObject({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1, 'password is required'),
});
export type LoginDto = z.infer<typeof loginDto>;

export interface AuthResponseDto {
  accessToken: string;
  expiresIn: number;
  user: {
    id: number;
    name: string;
    email: string;
    role: Role;
    studentId: number | null;
  };
}
