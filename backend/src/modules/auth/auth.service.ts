import type { Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { hasPrismaErrorCode } from '../../lib/prisma-errors.js';
import { signSessionToken } from './token.js';
import { setSessionCookie, clearSessionCookie } from './cookies.js';
import type { AuthUser } from './auth.types.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { AppError } from '../../errors/app-error.js';

const DUMMY_HASH = '$2b$12$21xo24dwHM4wHR5q8bWP4.kkHJqNrvm9pUW8hWHhqSn1Gs8mUl3SC';

export const findAuthUserById = async (userId: string): Promise<AuthUser | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
};

export const authenticateCredentials = async (
  input: LoginInput,
  response: Response,
): Promise<AuthUser> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await verifyPassword(input.password, hash);

  if (!user || !user.isActive || !ok) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const token = await signSessionToken(user.id);
  setSessionCookie(response, token);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

export const registerStudent = async (
  input: RegisterInput,
  response: Response,
): Promise<AuthUser> => {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'STUDENT',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const token = await signSessionToken(user.id);
    setSessionCookie(response, token);

    return user;
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2002')) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }

    throw error;
  }
};

export const logout = (response: Response): void => {
  clearSessionCookie(response);
};
