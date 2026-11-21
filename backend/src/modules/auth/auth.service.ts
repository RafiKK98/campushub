import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { signSessionToken } from './token.js';
import { setSessionCookie, clearSessionCookie } from './cookies.js';
import type { AuthUser } from './auth.types.js';
import type { LoginInput } from './auth.schemas.js'; // Corrected import path for LoginInput
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
  const ok = await bcrypt.compare(input.password, hash);

  if (!user || !user.isActive || !ok) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const token = await signSessionToken(user.id);
  setSessionCookie(response, token);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

export const logout = (response: Response): void => {
  clearSessionCookie(response);
};
