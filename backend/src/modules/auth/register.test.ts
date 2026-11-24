import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { createRegistrationRateLimiter } from '../../middleware/rateLimiter.js';
import { errorHandler } from '../../middleware/error-handler.js';

const TEST_RUN_ID = randomUUID().slice(0, 8);
const EMAIL_PREFIX = `reg-test-${TEST_RUN_ID}`;
const TEST_PASSWORD = 'StudentPass123!';

const email = (suffix: string) => `${EMAIL_PREFIX}-${suffix}@campushub.test`;

const register = (payload: Record<string, unknown>) =>
  request(app).post('/api/v1/auth/register').set('Origin', env.FRONTEND_ORIGIN).send(payload);

const getCookie = (response: request.Response): string | null => {
  const setCookie = response.headers['set-cookie'];
  if (!setCookie) return null;

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.find((value) => value.startsWith(`${env.AUTH_COOKIE_NAME}=`)) ?? null;
};

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
  await prisma.$disconnect();
});

describe('Public student registration', () => {
  it('creates an active student, hashes the password, sets a session cookie, and hides secrets', async () => {
    const res = await register({
      name: 'New Student',
      email: email('success'),
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      name: 'New Student',
      email: email('success'),
      role: 'STUDENT',
      isActive: true,
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2b$');

    const cookie = getCookie(res);
    expect(cookie).toBeTruthy();
    expect(cookie).toContain(`${env.AUTH_COOKIE_NAME}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const stored = await prisma.user.findUnique({ where: { email: email('success') } });
    expect(stored).not.toBeNull();
    expect(stored?.role).toBe('STUDENT');
    expect(stored?.isActive).toBe(true);
    expect(stored?.passwordHash).not.toBe(TEST_PASSWORD);
    expect(stored?.passwordHash.startsWith('$2')).toBe(true);
    expect(await bcrypt.compare(TEST_PASSWORD, stored!.passwordHash)).toBe(true);
  });

  it('rejects a duplicate email with 409 EMAIL_EXISTS', async () => {
    const first = await register({
      name: 'Duplicate User',
      email: email('duplicate'),
      password: TEST_PASSWORD,
    });
    expect(first.status).toBe(201);

    const second = await register({
      name: 'Duplicate User',
      email: email('duplicate'),
      password: TEST_PASSWORD,
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EMAIL_EXISTS');
    expect(JSON.stringify(second.body)).not.toContain('passwordHash');
  });

  it('returns 400 validation errors for invalid input', async () => {
    const res = await register({ name: '', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((detail: { path: string }) => detail.path);
    expect(paths).toContain('name');
    expect(paths).toContain('email');
    expect(paths).toContain('password');
  });

  it('ignores client-supplied role and isActive fields (no privilege escalation)', async () => {
    const res = await register({
      name: 'Would-be Admin',
      email: email('escalation'),
      password: TEST_PASSWORD,
      role: 'ADMIN',
      isActive: false,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('STUDENT');
    expect(res.body.data.user.isActive).toBe(true);

    const stored = await prisma.user.findUnique({ where: { email: email('escalation') } });
    expect(stored?.role).toBe('STUDENT');
    expect(stored?.isActive).toBe(true);
  });

  it('normalizes the email by trimming and lowercasing', async () => {
    const mixedCase = `  ${EMAIL_PREFIX}-Normalized@CampusHub.Test  `;
    const res = await register({
      name: 'Normalized User',
      email: mixedCase,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(`${EMAIL_PREFIX}-normalized@campushub.test`);
  });

  it('establishes a working session cookie and allows subsequent login', async () => {
    const res = await register({
      name: 'Session User',
      email: email('session'),
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(201);

    const cookie = getCookie(res);
    expect(cookie).toBeTruthy();

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie!);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(email('session'));
    expect(me.body.data.user.role).toBe('STUDENT');

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({ email: email('session'), password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('STUDENT');
  });

  it('rate limits repeated registration attempts', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.post(
      '/register-test',
      createRegistrationRateLimiter({ limit: 2, windowMs: 60000 }),
      (_req, res) => {
        res.status(201).json({ data: { ok: true } });
      },
    );
    testApp.use(errorHandler);

    await request(testApp).post('/register-test').send({}).expect(201);
    await request(testApp).post('/register-test').send({}).expect(201);

    const res = await request(testApp).post('/register-test').send({});
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
