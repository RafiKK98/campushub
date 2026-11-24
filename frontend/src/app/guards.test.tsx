import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../features/auth/auth-context';
import type { AuthUser } from '../types/api';
import { ProtectedRoute, RoleHomeRedirect, RoleRoute } from './guards';

const makeUser = (role: AuthUser['role']): AuthUser => ({
  id: 'user-1',
  name: 'Test User',
  email: 'user@campushub.local',
  role,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const renderWithAuth = (value: Partial<AuthContextValue>, initialPath: string) => {
  const contextValue: AuthContextValue = {
    user: null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...value,
  };

  return render(
    <AuthContext.Provider value={contextValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<div>login-page</div>} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route index element={<RoleHomeRedirect />} />
            <Route path="/admin" element={<div>admin-home</div>} />
            <Route path="/instructor" element={<div>instructor-home</div>} />
            <Route path="/student" element={<div>student-home</div>} />
            <Route element={<RoleRoute roles={['ADMIN']} />}>
              <Route path="/admin-only" element={<div>admin-only</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
};

describe('route guards', () => {
  it('redirects unauthenticated users to /login', () => {
    renderWithAuth({ user: null, isLoading: false }, '/admin-only');
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('redirects users without the required role to /forbidden', () => {
    renderWithAuth({ user: makeUser('STUDENT'), isLoading: false }, '/admin-only');
    expect(screen.getByText('forbidden-page')).toBeInTheDocument();
  });

  it('allows users with a matching role', () => {
    renderWithAuth({ user: makeUser('ADMIN'), isLoading: false }, '/admin-only');
    expect(screen.getByText('admin-only')).toBeInTheDocument();
  });

  it('redirects / to the user role home', () => {
    renderWithAuth({ user: makeUser('INSTRUCTOR'), isLoading: false }, '/');
    expect(screen.getByText('instructor-home')).toBeInTheDocument();
  });
});
