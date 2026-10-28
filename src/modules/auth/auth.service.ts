import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { conflict, unauthorized } from '../../errors/AppError.js';
import { isUniqueViolation } from '../../errors/dbError.js';
import * as userRepository from '../user/user.repository.js';
import type { AuthResponseDto, LoginDto, RegisterDto } from './auth.dto.js';
import type { AuthUser } from './auth.interface.js';

const SALT_ROUNDS = 10;

function issueToken(user: AuthUser): AuthResponseDto {
  const accessToken = jwt.sign({ sub: user.id }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  } as jwt.SignOptions);
  return {
    accessToken,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
    },
  };
}

/** Public registration always creates a plain 'user' with no student/mark access. */
export const register = async (dto: RegisterDto): Promise<AuthResponseDto> => {
  const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
  try {
    const created = await userRepository.insertUser(dto.name, dto.email, passwordHash, 'user');
    return issueToken({
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
      studentId: created.studentId,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('A user with that email already exists');
    throw error;
  }
};

export const login = async (dto: LoginDto): Promise<AuthResponseDto> => {
  const account = await userRepository.findAuthByEmail(dto.email);
  if (!account) throw unauthorized('Invalid email or password');

  const ok = await bcrypt.compare(dto.password, account.passwordHash);
  if (!ok) throw unauthorized('Invalid email or password');

  return issueToken({
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    studentId: account.studentId,
  });
};

/** Helper for tests: build a signed access token for a user id. */
export function signAccessToken(userId: number): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  } as jwt.SignOptions);
}
