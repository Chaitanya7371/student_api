import type { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto.js';
import { conflict, notFound } from '../../errors/AppError.js';
import { isUniqueViolation } from '../../errors/dbError.js';
import type { User } from './user.interface.js';
import * as userRepository from './user.repository.js';

const toResponse = (user: User): UserResponseDto => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  studentId: user.studentId,
  createdAt: user.createdAt.toISOString(),
});

const getOrThrow = async (id: number): Promise<User> => {
  const user = await userRepository.findUserById(id);
  if (!user) throw notFound(`User ${id} not found`);
  return user;
};

const assertEmailAvailable = async (email: string, exceptId?: number): Promise<void> => {
  const existing = await userRepository.findUserByEmail(email);
  if (existing && existing.id !== exceptId) throw conflict('A user with that email already exists');
};

export const findAllUsers = async (): Promise<UserResponseDto[]> => {
  const users = await userRepository.findAllUsers();
  return users.map(toResponse);
};

export const findUserById = async (id: number): Promise<UserResponseDto> => toResponse(await getOrThrow(id));

export const createUser = async (dto: CreateUserDto): Promise<UserResponseDto> => {
  await assertEmailAvailable(dto.email);
  try {
    return toResponse(await userRepository.insertUser(dto.name, dto.email));
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('A user with that email already exists');
    throw error;
  }
};

export const updateUser = async (id: number, dto: UpdateUserDto): Promise<UserResponseDto> => {
  const user = await getOrThrow(id);
  const email = dto.email ?? user.email;
  if (dto.email) await assertEmailAvailable(dto.email, id);
  const updated = await userRepository.updateUser(id, dto.name ?? user.name, email);
  if (!updated) throw notFound(`User ${id} not found`);
  return toResponse(updated);
};

export const deleteUser = async (id: number): Promise<void> => {
  const deleted = await userRepository.deleteUserById(id);
  if (!deleted) throw notFound(`User ${id} not found`);
};
