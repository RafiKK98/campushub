import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../features/auth/auth-context';
import type { AuthUser, Role } from '../types/api';
import { AppShell } from './AppShell';

const makeUser = (role: Role): AuthUser => ({
  id: 'user-1',
  name: 'Alex Morgan',
  email: 'alex@campushub.local',
  role,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const renderShell = (role: Role) =>
  render(
    <AuthContext.Provider
      value={{
        user: makeUser(role),
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
      }}
    >
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div>content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe('AppShell navigation', () => {
  it('renders admin navigation items', () => {
    renderShell('ADMIN');
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Courses' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Announcements' })).toBeInTheDocument();
  });

  it('renders instructor navigation items', () => {
    renderShell('INSTRUCTOR');
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My Courses' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Assignments' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('renders student navigation items', () => {
    renderShell('STUDENT');
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Catalogue' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My Courses' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Assignments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Grades' })).toBeInTheDocument();
  });
});
