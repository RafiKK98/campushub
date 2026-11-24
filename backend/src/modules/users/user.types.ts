import type { Role } from '../../generated/prisma/enums.js';
import type { PaginationMeta } from '../courses/course.types.js';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserListResult {
  users: UserSummary[];
  meta: PaginationMeta;
}
