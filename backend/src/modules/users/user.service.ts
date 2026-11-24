import type { Prisma } from '../../generated/prisma/client.ts';
import { AppError } from '../../errors/app-error.js';
import { hashPassword } from '../../lib/password.js';
import { hasPrismaErrorCode } from '../../lib/prisma-errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { PaginationMeta } from '../courses/course.types.js';
import type { CreateUserInput, UpdateUserInput, UserListQuery } from './user.schemas.js';
import type { UserListResult, UserSummary } from './user.types.js';

const USER_NOT_FOUND_MESSAGE = 'User not found.';

const buildMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserWithSafeFields = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export const toUserSummary = (user: UserWithSafeFields): UserSummary => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const buildUserWhere = (query: UserListQuery): Prisma.UserWhereInput => {
  const filters: Prisma.UserWhereInput[] = [];

  if (query.search) {
    filters.push({
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }

  if (query.role) {
    filters.push({ role: query.role });
  }

  if (query.isActive !== undefined) {
    filters.push({ isActive: query.isActive });
  }

  return filters.length > 0 ? { AND: filters } : {};
};

export const listUsers = async (query: UserListQuery): Promise<UserListResult> => {
  const where = buildUserWhere(query);
  const skip = (query.page - 1) * query.limit;

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ role: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    users: users.map(toUserSummary),
    meta: buildMeta(query.page, query.limit, total),
  };
};

export const getUserById = async (userId: string): Promise<UserSummary> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', USER_NOT_FOUND_MESSAGE);
  }

  return toUserSummary(user);
};

export const createUser = async (input: CreateUserInput): Promise<UserSummary> => {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        isActive: input.isActive ?? true,
        passwordHash,
      },
      select: userSelect,
    });

    return toUserSummary(user);
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2002')) {
      throw new AppError(409, 'EMAIL_EXISTS', 'A user with this email already exists.');
    }

    throw error;
  }
};

export const updateUser = async (
  actor: AuthUser,
  userId: string,
  input: UpdateUserInput,
): Promise<UserSummary> => {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!existing) {
    throw new AppError(404, 'USER_NOT_FOUND', USER_NOT_FOUND_MESSAGE);
  }

  if (actor.id === userId) {
    if (input.role !== undefined && input.role !== existing.role) {
      throw new AppError(
        400,
        'CANNOT_CHANGE_OWN_ROLE',
        'Administrators cannot change their own role.',
      );
    }

    if (input.isActive === false) {
      throw new AppError(
        400,
        'CANNOT_DEACTIVATE_SELF',
        'Administrators cannot deactivate their own account.',
      );
    }
  }

  const data: Prisma.UserUpdateInput = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.role !== undefined) {
    data.role = input.role;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  if (input.password !== undefined) {
    data.passwordHash = await hashPassword(input.password);
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: userSelect,
    });

    return toUserSummary(user);
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2025')) {
      throw new AppError(404, 'USER_NOT_FOUND', USER_NOT_FOUND_MESSAGE);
    }

    throw error;
  }
};
