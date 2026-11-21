import type { AuthUser } from '../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      ip?: string; // Add ip property to Request interface
    }
  }
}

export {};
