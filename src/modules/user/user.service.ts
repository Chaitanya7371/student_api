import type { CreateUserDto, UpdateUserDto, UserResponseDto } from './user.dto';
import { conflict, notFound } from '../../errors/AppError';
import type { User } from './user.interface';

/**
 * Business logic. Knows nothing about Express (no req/res).
 * Uses an in-memory store to keep the example self-contained.
 */
let users: User[] = [];
let nextId = 1;

const toResponse = (user: User): UserResponseDto => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt.toISOString(),
});

const getOrThrow = (id: number): User => {
  const user = users.find((u) => u.id === id);
  if (!user) throw notFound(`User ${id} not found`);
  return user;
};

const assertEmailAvailable = (email: string, exceptId?: number): void => {
  if (users.some((u) => u.email === email && u.id !== exceptId)) {
    throw conflict('A user with that email already exists');
  }
};

export const findAllUsers = async (): Promise<UserResponseDto[]> => users.map(toResponse);

export const findUserById = async (id: number): Promise<UserResponseDto> => toResponse(getOrThrow(id));

export const createUser = async (dto: CreateUserDto): Promise<UserResponseDto> => {
  assertEmailAvailable(dto.email);
  const user: User = { id: nextId++, ...dto, createdAt: new Date() };
  users.push(user);
  return toResponse(user);
};

export const updateUser = async (id: number, dto: UpdateUserDto): Promise<UserResponseDto> => {
  const user = getOrThrow(id);
  if (dto.email) assertEmailAvailable(dto.email, id);
  Object.assign(user, dto);
  return toResponse(user);
};

export const deleteUser = async (id: number): Promise<void> => {
  getOrThrow(id);
  users = users.filter((u) => u.id !== id);
};
