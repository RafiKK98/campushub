import type { RequestHandler } from 'express';
import { verifySessionToken } from '../modules/auth/token.js';
import { findAuthUserById } from '../modules/auth/auth.service.js';
import { readSessionToken } from '../modules/auth/cookies.js';
import { AppError } from '../errors/app-error.js';

export const authenticate: RequestHandler = async (request, response, next) => {
  try {
    const token = readSessionToken(request.headers.cookie);
    if (!token) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }

    const payload = await verifySessionToken(token);
    if (!payload) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired session.');
    }

    const user = await findAuthUserById(payload.sub);
    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'User not found or inactive.');
    }

    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
