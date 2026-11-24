import { ApiError, apiRequest } from '../../lib/api-client';
import type { AuthUser, LoginInput, RegisterInput } from '../../types/api';

export const fetchCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    const response = await apiRequest<{ user: AuthUser }>('/auth/me');
    return response.data.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
};

export const loginRequest = async (input: LoginInput): Promise<AuthUser> => {
  const response = await apiRequest<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    json: input,
  });

  return response.data.user;
};

export const registerRequest = async (input: RegisterInput): Promise<AuthUser> => {
  const response = await apiRequest<{ user: AuthUser }>('/auth/register', {
    method: 'POST',
    json: input,
  });

  return response.data.user;
};

export const logoutRequest = async (): Promise<void> => {
  await apiRequest<undefined>('/auth/logout', { method: 'POST' });
};
