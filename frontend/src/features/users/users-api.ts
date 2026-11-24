import { apiRequest, requireMeta, toQueryString } from '../../lib/api-client';
import type { PaginationMeta, Role, UserSummary } from '../../types/api';

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

export interface UserListResult {
  users: UserSummary[];
  meta: PaginationMeta;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  password: string;
  isActive?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  role?: Role;
  isActive?: boolean;
  password?: string;
}

export const listUsers = async (params: UserListParams): Promise<UserListResult> => {
  const response = await apiRequest<{ users: UserSummary[] }>(
    `/admin/users${toQueryString({ ...params })}`,
  );

  return { users: response.data.users, meta: requireMeta(response.meta) };
};

export const getUser = async (id: string): Promise<UserSummary> => {
  const response = await apiRequest<{ user: UserSummary }>(`/admin/users/${id}`);
  return response.data.user;
};

export const createUser = async (input: CreateUserInput): Promise<UserSummary> => {
  const response = await apiRequest<{ user: UserSummary }>('/admin/users', {
    method: 'POST',
    json: input,
  });

  return response.data.user;
};

export const updateUser = async (id: string, input: UpdateUserInput): Promise<UserSummary> => {
  const response = await apiRequest<{ user: UserSummary }>(`/admin/users/${id}`, {
    method: 'PATCH',
    json: input,
  });

  return response.data.user;
};
