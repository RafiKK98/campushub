import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { TEST_PASSWORD, createTestUser, loginAs } from '../../test/helpers.js';

const RUN_ID = randomUUID().slice(0, 8);
const EMAIL_PREFIX = `m7-users-${RUN_ID}`;
const emailFor = (label: string) => `${EMAIL_PREFIX}-${label}@campushub.test`;
const NEW_PASSWORD = 'BrandNewPass123!';

interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

let admin: Awaited<ReturnType<typeof createTestUser>>;
let instructor: Awaited<ReturnType<typeof createTestUser>>;
let student: Awaited<ReturnType<typeof createTestUser>>;
let inactiveUser: Awaited<ReturnType<typeof createTestUser>>;

let adminCookie: string;
let instructorCookie: string;
let studentCookie: string;

const listUsers = (cookie: string, query = '') =>
  request(app).get(`/api/v1/admin/users${query}`).set('Cookie', cookie);

const createUserRequest = (cookie: string, body: Record<string, unknown>) =>
  request(app).post('/api/v1/admin/users').set('Cookie', cookie).send(body);

const updateUserRequest = (cookie: string, id: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/v1/admin/users/${id}`).set('Cookie', cookie).send(body);

beforeAll(async () => {
  [admin, instructor, student] = await Promise.all([
    createTestUser({ email: emailFor('admin'), role: 'ADMIN', name: `M7 Users Admin ${RUN_ID}` }),
    createTestUser({
      email: emailFor('instructor'),
      role: 'INSTRUCTOR',
      name: `M7 Users Instructor ${RUN_ID}`,
    }),
    createTestUser({
      email: emailFor('student'),
      role: 'STUDENT',
      name: `M7 Users Student ${RUN_ID}`,
    }),
  ]);

  inactiveUser = await createTestUser({
    email: emailFor('inactive'),
    role: 'STUDENT',
    name: `M7 Users Inactive ${RUN_ID}`,
    isActive: false,
  });

  [adminCookie, instructorCookie, studentCookie] = await Promise.all([
    loginAs(admin.email),
    loginAs(instructor.email),
    loginAs(student.email),
  ]);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${EMAIL_PREFIX}-` } } });
  await prisma.$disconnect();
}, 30_000);

describe('User management authorization', () => {
  it('requires authentication to list users', async () => {
    const response = await request(app).get('/api/v1/admin/users');
    expect(response.status).toBe(401);
  });

  it('forbids instructors from listing users', async () => {
    const response = await listUsers(instructorCookie);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('forbids students from creating users', async () => {
    const response = await createUserRequest(studentCookie, {
      name: 'Blocked',
      email: emailFor('blocked'),
      role: 'STUDENT',
      password: NEW_PASSWORD,
    });
    expect(response.status).toBe(403);
  });

  it('forbids instructors from reading a user', async () => {
    const response = await request(app)
      .get(`/api/v1/admin/users/${student.id}`)
      .set('Cookie', instructorCookie);
    expect(response.status).toBe(403);
  });

  it('forbids instructors from updating a user', async () => {
    const response = await updateUserRequest(instructorCookie, student.id, { name: 'Hacked' });
    expect(response.status).toBe(403);
  });
});

describe('User listing', () => {
  it('lists users without exposing password hashes', async () => {
    const response = await listUsers(adminCookie, '?limit=100');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.users)).toBe(true);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 100 });
    expect(response.body.meta.total).toBeGreaterThanOrEqual(4);
    expect(response.body.meta.totalPages).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('filters by search term across name and email', async () => {
    const response = await listUsers(adminCookie, `?search=${RUN_ID}&limit=100`);
    expect(response.status).toBe(200);
    const users = response.body.data.users as UserResponse[];
    expect(users.length).toBeGreaterThanOrEqual(3);
    expect(
      users.every(
        (user) =>
          user.name.toLowerCase().includes(RUN_ID) || user.email.toLowerCase().includes(RUN_ID),
      ),
    ).toBe(true);
  });

  it('filters by role', async () => {
    const response = await listUsers(adminCookie, `?search=${RUN_ID}&role=INSTRUCTOR&limit=100`);
    expect(response.status).toBe(200);
    const users = response.body.data.users as UserResponse[];
    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users.every((user) => user.role === 'INSTRUCTOR')).toBe(true);
    expect(users.some((user) => user.id === instructor.id)).toBe(true);
  });

  it('filters by active status', async () => {
    const response = await listUsers(adminCookie, `?search=${RUN_ID}&isActive=false&limit=100`);
    expect(response.status).toBe(200);
    const users = response.body.data.users as UserResponse[];
    expect(users.every((user) => user.isActive === false)).toBe(true);
    expect(users.some((user) => user.id === inactiveUser.id)).toBe(true);
  });

  it('supports pagination metadata', async () => {
    const response = await listUsers(adminCookie, '?page=1&limit=1');
    expect(response.status).toBe(200);
    expect((response.body.data.users as UserResponse[]).length).toBe(1);
    expect(response.body.meta.limit).toBe(1);
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid filters', async () => {
    const response = await listUsers(adminCookie, '?role=SUPERUSER');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('User creation', () => {
  it('creates a user with a normalized email and a hashed password', async () => {
    const email = `M7-USERS-${RUN_ID}-CREATED@CAMPUSHUB.TEST`;
    const response = await createUserRequest(adminCookie, {
      name: `Created ${RUN_ID}`,
      email,
      role: 'INSTRUCTOR',
      password: NEW_PASSWORD,
    });

    expect(response.status).toBe(201);
    const created = response.body.data.user as UserResponse;
    expect(created.id).toBeDefined();
    expect(created.email).toBe(email.toLowerCase());
    expect(created.role).toBe('INSTRUCTOR');
    expect(created.isActive).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const stored = await prisma.user.findUnique({ where: { id: created.id } });
    expect(stored).not.toBeNull();
    expect(stored?.passwordHash).not.toBe(NEW_PASSWORD);
    expect(await bcrypt.compare(NEW_PASSWORD, stored?.passwordHash ?? '')).toBe(true);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: email.toLowerCase(), password: NEW_PASSWORD });
    expect(loginResponse.status).toBe(200);
  });

  it('creates an inactive user when requested', async () => {
    const response = await createUserRequest(adminCookie, {
      name: `Inactive created ${RUN_ID}`,
      email: emailFor('created-inactive'),
      role: 'STUDENT',
      password: NEW_PASSWORD,
      isActive: false,
    });

    expect(response.status).toBe(201);
    expect((response.body.data.user as UserResponse).isActive).toBe(false);
  });

  it('rejects duplicate email addresses', async () => {
    const response = await createUserRequest(adminCookie, {
      name: 'Duplicate',
      email: admin.email.toUpperCase(),
      role: 'STUDENT',
      password: NEW_PASSWORD,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('validates missing and invalid fields', async () => {
    const missingPassword = await createUserRequest(adminCookie, {
      name: 'No Password',
      email: emailFor('no-password'),
      role: 'STUDENT',
    });
    expect(missingPassword.status).toBe(400);
    expect(missingPassword.body.error.code).toBe('VALIDATION_ERROR');

    const shortPassword = await createUserRequest(adminCookie, {
      name: 'Short Password',
      email: emailFor('short-password'),
      role: 'STUDENT',
      password: 'short',
    });
    expect(shortPassword.status).toBe(400);

    const invalidRole = await createUserRequest(adminCookie, {
      name: 'Bad Role',
      email: emailFor('bad-role'),
      role: 'SUPERUSER',
      password: NEW_PASSWORD,
    });
    expect(invalidRole.status).toBe(400);

    const invalidEmail = await createUserRequest(adminCookie, {
      name: 'Bad Email',
      email: 'not-an-email',
      role: 'STUDENT',
      password: NEW_PASSWORD,
    });
    expect(invalidEmail.status).toBe(400);
  });
});

describe('User detail', () => {
  it('returns a single user without a password hash', async () => {
    const response = await request(app)
      .get(`/api/v1/admin/users/${instructor.id}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    const user = response.body.data.user as UserResponse;
    expect(user.id).toBe(instructor.id);
    expect(user.email).toBe(instructor.email);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('returns 404 for a missing user', async () => {
    const response = await request(app)
      .get(`/api/v1/admin/users/${randomUUID()}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('rejects an invalid user id', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users/not-a-uuid')
      .set('Cookie', adminCookie);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('User updates', () => {
  it('updates name, role and active status', async () => {
    const target = await createTestUser({
      email: emailFor('update-target'),
      role: 'STUDENT',
      name: `Update Target ${RUN_ID}`,
    });

    const response = await updateUserRequest(adminCookie, target.id, {
      name: `Updated ${RUN_ID}`,
      role: 'INSTRUCTOR',
      isActive: false,
    });

    expect(response.status).toBe(200);
    const user = response.body.data.user as UserResponse;
    expect(user.name).toBe(`Updated ${RUN_ID}`);
    expect(user.role).toBe('INSTRUCTOR');
    expect(user.isActive).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('updates a password without exposing the hash', async () => {
    const target = await createTestUser({
      email: emailFor('password-target'),
      role: 'STUDENT',
      name: `Password Target ${RUN_ID}`,
    });

    const response = await updateUserRequest(adminCookie, target.id, { password: NEW_PASSWORD });
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const stored = await prisma.user.findUnique({ where: { id: target.id } });
    expect(await bcrypt.compare(NEW_PASSWORD, stored?.passwordHash ?? '')).toBe(true);
    expect(await bcrypt.compare(TEST_PASSWORD, stored?.passwordHash ?? '')).toBe(false);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: target.email, password: NEW_PASSWORD });
    expect(loginResponse.status).toBe(200);
  });

  it('rejects empty update payloads', async () => {
    const response = await updateUserRequest(adminCookie, student.id, {});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when updating a missing user', async () => {
    const response = await updateUserRequest(adminCookie, randomUUID(), { name: 'Missing' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('prevents an administrator from deactivating their own account', async () => {
    const response = await updateUserRequest(adminCookie, admin.id, { isActive: false });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');

    const stored = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(stored?.isActive).toBe(true);
  });

  it('prevents an administrator from changing their own role', async () => {
    const response = await updateUserRequest(adminCookie, admin.id, { role: 'STUDENT' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CANNOT_CHANGE_OWN_ROLE');

    const stored = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(stored?.role).toBe('ADMIN');
  });

  it('allows an administrator to update their own name and keep their role', async () => {
    const response = await updateUserRequest(adminCookie, admin.id, {
      name: `Renamed Admin ${RUN_ID}`,
      role: 'ADMIN',
    });

    expect(response.status).toBe(200);
    const user = response.body.data.user as UserResponse;
    expect(user.name).toBe(`Renamed Admin ${RUN_ID}`);
    expect(user.role).toBe('ADMIN');
  });

  it('allows an administrator to change their own password', async () => {
    const response = await updateUserRequest(adminCookie, admin.id, { password: NEW_PASSWORD });
    expect(response.status).toBe(200);

    const stored = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(await bcrypt.compare(NEW_PASSWORD, stored?.passwordHash ?? '')).toBe(true);
  });
});
