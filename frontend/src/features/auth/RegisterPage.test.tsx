import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-client';
import type { AuthUser, RegisterInput } from '../../types/api';
import { AuthContext, type AuthContextValue } from './auth-context';
import { RegisterPage } from './RegisterPage';

const studentUser: AuthUser = {
  id: 'student-1',
  name: 'New Student',
  email: 'new.student@campushub.local',
  role: 'STUDENT',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderRegister = (register: AuthContextValue['register']) => {
  const Harness = () => {
    const [user, setUser] = useState<AuthUser | null>(null);

    const value: AuthContextValue = {
      user,
      isLoading: false,
      login: vi.fn(),
      register: async (input: RegisterInput) => {
        const nextUser = await register(input);
        setUser(nextUser);
        return nextUser;
      },
      logout: vi.fn(),
    };

    return (
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<div>login-page</div>} />
            <Route path="/student" element={<div>student-dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );
  };

  return render(<Harness />);
};

type FormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const fillForm = async (
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<FormValues> = {},
) => {
  const values: FormValues = {
    name: 'New Student',
    email: 'new.student@campushub.local',
    password: 'StudentPass123!',
    confirmPassword: 'StudentPass123!',
    ...overrides,
  };

  await user.type(screen.getByLabelText('Full name'), values.name);
  await user.type(screen.getByLabelText('Email'), values.email);
  await user.type(screen.getByLabelText('Password'), values.password);
  await user.type(screen.getByLabelText('Confirm password'), values.confirmPassword);
};

describe('RegisterPage', () => {
  it('validates required fields before submitting', async () => {
    const register = vi.fn();
    const user = userEvent.setup();
    renderRegister(register);

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Full name is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByText('Please confirm your password.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a mismatched password confirmation', async () => {
    const register = vi.fn();
    const user = userEvent.setup();
    renderRegister(register);

    await fillForm(user, { confirmPassword: 'DifferentPass123!' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers a student and redirects to the student dashboard', async () => {
    const register = vi.fn().mockResolvedValue(studentUser);
    const user = userEvent.setup();
    renderRegister(register);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        name: 'New Student',
        email: 'new.student@campushub.local',
        password: 'StudentPass123!',
      });
    });
    expect(await screen.findByText('student-dashboard')).toBeInTheDocument();
  });

  it('shows API errors returned by registration', async () => {
    const register = vi
      .fn()
      .mockRejectedValue(
        new ApiError(409, 'EMAIL_EXISTS', 'An account with this email already exists.'),
      );
    const user = userEvent.setup();
    renderRegister(register);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('An account with this email already exists.'),
    ).toBeInTheDocument();
  });

  it('links back to the login page', async () => {
    const user = userEvent.setup();
    renderRegister(vi.fn());

    await user.click(screen.getByRole('link', { name: 'Sign in' }));

    expect(await screen.findByText('login-page')).toBeInTheDocument();
  });
});
