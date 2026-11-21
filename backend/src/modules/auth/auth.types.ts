import type { Role } from '../../generated/prisma/enums.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPayload {
  sub: string;
}
