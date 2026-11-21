import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const originGuard: RequestHandler = (request, response, next) => {
  if (SAFE_METHODS.has(request.method)) {
    next();
    return;
  }

  const origin = request.get('origin');
  if (!origin) {
    // Allow requests without Origin header (e.g., server-to-server, curl)
    // CSRF protection is provided by SameSite=Lax cookies.
    next();
    return;
  }

  if (origin !== env.FRONTEND_ORIGIN) {
    next(new AppError(403, 'INVALID_ORIGIN', 'Request origin is not allowed.'));
    return;
  }

  next();
};
