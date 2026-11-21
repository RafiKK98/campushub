import type { RequestHandler } from 'express';
import type { Role } from '../generated/prisma/enums.js';
import { AppError } from '../errors/app-error.js';

export const requireRole = (...allowedRoles: Role[]): RequestHandler => {
  return (request, response, next) => {
    const user = request.user;
    if (!user) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.'));
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions.'));
      return;
    }

    next();
  };
};
