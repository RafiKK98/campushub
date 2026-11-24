import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { queryKeys } from '../../lib/query-keys';
import type { AuthUser, LoginInput, RegisterInput } from '../../types/api';
import { fetchCurrentUser, loginRequest, logoutRequest, registerRequest } from './auth-api';
import { AuthContext, type AuthContextValue } from './auth-context';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({ mutationFn: loginRequest });
  const registerMutation = useMutation({ mutationFn: registerRequest });
  const logoutMutation = useMutation({ mutationFn: logoutRequest });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isLoading,
      login: async (input: LoginInput) => {
        const user = await loginMutation.mutateAsync(input);
        queryClient.setQueryData<AuthUser | null>(queryKeys.me, user);
        return user;
      },
      register: async (input: RegisterInput) => {
        const user = await registerMutation.mutateAsync(input);
        queryClient.setQueryData<AuthUser | null>(queryKeys.me, user);
        return user;
      },
      logout: async () => {
        await logoutMutation.mutateAsync();
        await queryClient.cancelQueries();
        queryClient.clear();
        queryClient.setQueryData<AuthUser | null>(queryKeys.me, null);
      },
    }),
    [meQuery.data, meQuery.isLoading, loginMutation, registerMutation, logoutMutation, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
