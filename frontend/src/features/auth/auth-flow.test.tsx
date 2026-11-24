import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute, RoleRoute } from '../../app/guards';
import { AppShell } from '../../components/AppShell';
import { queryKeys } from '../../lib/query-keys';
import type { AuthUser } from '../../types/api';
import { AuthProvider } from './AuthProvider';
import { LoginPage } from './LoginPage';

const admin: AuthUser = {
  id: 'admin-1',
  name: 'Admin User',
  email: 'admin@campushub.local',
  role: 'ADMIN',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const instructor: AuthUser = {
  ...admin,
  id: 'instructor-1',
  name: 'Maya Chen',
  email: 'maya.chen@campushub.local',
  role: 'INSTRUCTOR',
};

const student: AuthUser = {
  ...admin,
  id: 'student-1',
  name: 'Priya Patel',
  email: 'priya.patel@campushub.local',
  role: 'STUDENT',
};

const accounts: AuthUser[] = [admin, instructor, student];
const usersByEmail = Object.fromEntries(accounts.map((user) => [user.email, user])) as Record<
  string,
  AuthUser
>;

const jsonResponse = (status: number, body?: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

let session: AuthUser | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });

const renderApp = (initialEntries: string[] = ['/login']) => {
  const queryClient = createTestQueryClient();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route element={<RoleRoute roles={['ADMIN']} />}>
                  <Route path="/admin" element={<div>admin-dashboard</div>} />
                </Route>
                <Route element={<RoleRoute roles={['INSTRUCTOR']} />}>
                  <Route path="/instructor" element={<div>instructor-dashboard</div>} />
                </Route>
                <Route element={<RoleRoute roles={['STUDENT']} />}>
                  <Route path="/student" element={<div>student-dashboard</div>} />
                </Route>
                <Route path="/forbidden" element={<div>forbidden-page</div>} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...view, queryClient };
};

const signIn = async (
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password = 'DemoPass123!',
) => {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
};

const signOut = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
};

const waitForLoginPage = () => screen.findByRole('button', { name: 'Sign in' });

beforeEach(() => {
  session = null;
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url === '/api/v1/auth/me' && method === 'GET') {
      return session
        ? jsonResponse(200, { data: { user: session } })
        : jsonResponse(401, {
            error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
          });
    }

    if (url === '/api/v1/auth/login' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { email: string };
      const user = usersByEmail[body.email];

      if (!user) {
        return jsonResponse(401, {
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        });
      }

      session = user;
      return jsonResponse(200, { data: { user } });
    }

    if (url === '/api/v1/auth/logout' && method === 'POST') {
      session = null;
      return jsonResponse(204);
    }

    return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const expectRoleSwitch = async (
  from: AuthUser,
  to: AuthUser,
  fromDashboard: string,
  toDashboard: string,
) => {
  const user = userEvent.setup();
  const { queryClient } = renderApp();

  await signIn(user, from.email);
  expect(await screen.findByText(fromDashboard)).toBeInTheDocument();
  expect(queryClient.getQueryData<AuthUser>(queryKeys.me)?.role).toBe(from.role);

  await signOut(user);
  await waitForLoginPage();
  expect(queryClient.getQueryData(queryKeys.me)).toBeNull();

  await signIn(user, to.email);
  expect(await screen.findByText(toDashboard)).toBeInTheDocument();
  expect(screen.queryByText('forbidden-page')).not.toBeInTheDocument();
  expect(queryClient.getQueryData<AuthUser>(queryKeys.me)?.role).toBe(to.role);
};

describe('authentication role switching', () => {
  it('switches from student to instructor without hitting /forbidden', async () => {
    await expectRoleSwitch(student, instructor, 'student-dashboard', 'instructor-dashboard');
  });

  it('switches from instructor to admin without hitting /forbidden', async () => {
    await expectRoleSwitch(instructor, admin, 'instructor-dashboard', 'admin-dashboard');
  });

  it('switches from admin to student without hitting /forbidden', async () => {
    await expectRoleSwitch(admin, student, 'admin-dashboard', 'student-dashboard');
  });

  it('clears user-specific query cache on logout', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderApp();

    await signIn(user, student.email);
    expect(await screen.findByText('student-dashboard')).toBeInTheDocument();

    queryClient.setQueryData(['student-courses', {}], { data: { courses: [] } });
    await signOut(user);
    await waitForLoginPage();

    expect(queryClient.getQueryData(['student-courses', {}])).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.me)).toBeNull();
  });

  it('still shows /forbidden for genuine unauthorized access', async () => {
    session = student;
    renderApp(['/admin']);

    expect(await screen.findByText('forbidden-page')).toBeInTheDocument();
  });

  it('bootstraps an existing session on refresh', async () => {
    session = instructor;
    renderApp(['/instructor']);

    expect(await screen.findByText('instructor-dashboard')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/me',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('redirects unauthenticated users to login on refresh', async () => {
    session = null;
    renderApp(['/student']);

    expect(await waitForLoginPage()).toBeInTheDocument();
  });
});
