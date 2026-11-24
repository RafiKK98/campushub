import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-client';
import type { AuthUser } from '../../types/api';
import { AuthContext, type AuthContextValue } from './auth-context';
import { LoginPage } from './LoginPage';

const studentUser: AuthUser = {
  id: 'student-1',
  name: 'Priya Patel',
  email: 'priya.patel@campushub.local',
  role: 'STUDENT',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderLogin = (login: AuthContextValue['login'], user: AuthUser | null = null) =>
  render(
    <AuthContext.Provider
      value={{ user, isLoading: false, login, register: vi.fn(), logout: vi.fn() }}
    >
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/student" element={<div>student-dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe('LoginPage', () => {
  it('validates required fields before submitting', async () => {
    const login = vi.fn();
    const user = userEvent.setup();
    renderLogin(login);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('calls login with credentials on valid submission', async () => {
    const login = vi.fn().mockResolvedValue(studentUser);
    const user = userEvent.setup();
    renderLogin(login);

    await user.type(screen.getByLabelText('Email'), 'priya.patel@campushub.local');
    await user.type(screen.getByLabelText('Password'), 'DemoPass123!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'priya.patel@campushub.local',
        password: 'DemoPass123!',
      });
    });
  });

  it('displays server errors returned by login', async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'));
    const user = userEvent.setup();
    renderLogin(login);

    await user.type(screen.getByLabelText('Email'), 'priya.patel@campushub.local');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  });
});
