import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import express from 'express';
import { app } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { createLoginRateLimiter } from '../../middleware/rateLimiter.js';
import { validateBody } from '../../middleware/validate.js';
import { loginSchema } from './auth.schemas.js';
import { authenticateCredentials } from './auth.service.js';

import { errorHandler, notFoundHandler } from '../../middleware/error-handler.js';

const TEST_PASSWORD = 'TestPass123!';
const TEST_RUN_ID = randomUUID().slice(0, 8);
const TEST_USERS = {
  admin: { email: `m2-test-${TEST_RUN_ID}-admin@campushub.test`, role: 'ADMIN' as const },
  instructor: {
    email: `m2-test-${TEST_RUN_ID}-instructor@campushub.test`,
    role: 'INSTRUCTOR' as const,
  },
  student: { email: `m2-test-${TEST_RUN_ID}-student@campushub.test`, role: 'STUDENT' as const },
};

let adminCookie: string;
let instructorCookie: string;
let studentCookie: string;

async function createTestUser(email: string, role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT') {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      name: `Test ${role}`,
      email,
      passwordHash,
      role,
      isActive: true,
    },
  });
  return user;
}

async function login(email: string, password: string) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', env.FRONTEND_ORIGIN)
    .send({ email, password });
  return res;
}

async function getCookie(res: request.Response) {
  const setCookieHeader = res.headers['set-cookie'];
  if (!setCookieHeader) return null;

  const cookiesArray: string[] = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const cookie = cookiesArray.find((c: string) => c.startsWith(`${env.AUTH_COOKIE_NAME}=`));
  return cookie ?? null;
}

beforeAll(async () => {
  // Create test users
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _adminUser = await createTestUser(TEST_USERS.admin.email, TEST_USERS.admin.role);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _instructorUser = await createTestUser(
    TEST_USERS.instructor.email,
    TEST_USERS.instructor.role,
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _studentUser = await createTestUser(TEST_USERS.student.email, TEST_USERS.student.role);

  // Log in to get cookies for each role
  const adminRes = await login(TEST_USERS.admin.email, TEST_PASSWORD);
  adminCookie = (await getCookie(adminRes))!;
  expect(adminRes.status).toBe(200);
  expect(adminCookie).toBeTruthy();
  expect(adminCookie).toContain('HttpOnly');
  expect(adminCookie).toContain('SameSite=Lax');
  expect(adminCookie).not.toContain('Secure'); // test env secure=false

  const instructorRes = await login(TEST_USERS.instructor.email, TEST_PASSWORD);
  instructorCookie = (await getCookie(instructorRes))!;
  expect(instructorRes.status).toBe(200);

  const studentRes = await login(TEST_USERS.student.email, TEST_PASSWORD);
  studentCookie = (await getCookie(studentRes))!;
  expect(studentRes.status).toBe(200);
});

afterAll(async () => {
  // Clean up test users
  await prisma.user.deleteMany({
    where: { email: { startsWith: `m2-test-${TEST_RUN_ID}-` } },
  });
  await prisma.$disconnect();
});

describe('Authentication', () => {
  it('should reject invalid password with generic error', async () => {
    const res = await login(TEST_USERS.admin.email, 'wrong');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  it('should reject unknown email with same generic error', async () => {
    const res = await login('unknown@campushub.test', TEST_PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should reject inactive user', async () => {
    // Create an inactive user
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
    const inactiveUser = await prisma.user.create({
      data: {
        name: 'Inactive',
        email: `m2-test-${TEST_RUN_ID}-inactive@campushub.test`,
        passwordHash,
        role: 'STUDENT',
        isActive: false,
      },
    });

    const res = await login(inactiveUser.email, TEST_PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');

    // Clean up
    await prisma.user.delete({ where: { id: inactiveUser.id } });
  });

  it('should return current user with valid cookie', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', adminCookie!);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(TEST_USERS.admin.email);
    expect(res.body.data.user.role).toBe('ADMIN');
    // passwordHash not present
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('should reject missing cookie', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should reject invalid cookie', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'campushub_session=not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should reject expired token', async () => {
    // Create an expired token using the same secret
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const expiredToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('non-existent-id')
      .setIssuer('campushub-api')
      .setAudience('campushub-web')
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // expired 60 seconds ago
      .sign(secret);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${env.AUTH_COOKIE_NAME}=${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should logout and clear cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', env.FRONTEND_ORIGIN)
      .set('Cookie', adminCookie!);
    expect(res.status).toBe(204);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    const cleared = setCookie!.find((c) => c.startsWith(`${env.AUTH_COOKIE_NAME}=`));
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
  });
});

describe('Role-based authorization', () => {
  // Helper to create a test-only admin-only endpoint
  const adminOnlyRouter = express();
  adminOnlyRouter.use(express.json());
  adminOnlyRouter.get('/admin-only', authenticate, requireRole('ADMIN'), (_req, res) => {
    res.json({ data: { ok: true } });
  });
  // Add error handlers to the test router
  adminOnlyRouter.use(notFoundHandler); // notFoundHandler
  adminOnlyRouter.use(errorHandler); // errorHandler

  it('should allow admin', async () => {
    const res = await request(adminOnlyRouter).get('/admin-only').set('Cookie', adminCookie!);
    expect(res.status).toBe(200);
  });

  it('should forbid instructor', async () => {
    const res = await request(adminOnlyRouter).get('/admin-only').set('Cookie', instructorCookie!);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should forbid student', async () => {
    const res = await request(adminOnlyRouter).get('/admin-only').set('Cookie', studentCookie!);
    expect(res.status).toBe(403);
  });

  it('should reject unauthenticated', async () => {
    const res = await request(adminOnlyRouter).get('/admin-only');
    expect(res.status).toBe(401);
  });

  it('should not trust role claim in token', async () => {
    // Create a token with student sub but admin role claim
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const student = await prisma.user.findUnique({ where: { email: TEST_USERS.student.email } });
    const forgedToken = await new SignJWT({ role: 'ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(student!.id)
      .setIssuer('campushub-api')
      .setAudience('campushub-web')
      .setIssuedAt()
      .setExpirationTime(`${env.AUTH_TOKEN_TTL_SECONDS}s`)
      .sign(secret);

    const res = await request(adminOnlyRouter)
      .get('/admin-only')
      .set('Cookie', `${env.AUTH_COOKIE_NAME}=${forgedToken}`);
    // Should still be forbidden because middleware loads role from DB
    expect(res.status).toBe(403);
  });
});

describe('Origin guard', () => {
  it('should reject unsafe request from disallowed origin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://evil.example')
      .send({ email: TEST_USERS.admin.email, password: TEST_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_ORIGIN');
  });

  it('should allow safe methods from any origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://evil.example');
    expect(res.status).toBe(200);
  });
});

describe('Rate limiting', () => {
  it('should return 429 after exceeding login attempts', async () => {
    // Create a test app with a strict limiter (limit 2)
    const testApp = express();
    testApp.use(express.json());
    testApp.set('trust proxy', 1);
    // const limiter = createLoginRateLimiter(); // Removed unused
    // Override limit for this test by creating a new limiter with limit 2
    // We'll create a new limiter instance with custom options
    const { rateLimit } = await import('express-rate-limit');
    const strictLimiter = rateLimit({
      windowMs: 60000,
      limit: 2,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      keyGenerator: ipKeyGenerator,
      handler: (_req, res, _next) => {
        res.status(429).json({
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many login attempts. Try again later.',
          },
        });
      },
    });

    testApp.post(
      '/login-test',
      strictLimiter,
      validateBody(loginSchema),
      async (req, res, next) => {
        try {
          await authenticateCredentials(req.body, res);
          res.json({ data: { ok: true } });
        } catch (e) {
          next(e);
        }
      },
    );

    // Use a unique IP by setting X-Forwarded-For
    const ip = `10.0.0.${randomUUID().slice(0, 3)}`;

    // First failed attempt
    await request(testApp)
      .post('/login-test')
      .set('X-Forwarded-For', ip)
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({ email: TEST_USERS.admin.email, password: 'wrong' })
      .expect(401);

    // Second failed attempt
    await request(testApp)
      .post('/login-test')
      .set('X-Forwarded-For', ip)
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({ email: TEST_USERS.admin.email, password: 'wrong' })
      .expect(401);

    // Third attempt should be rate limited
    const res = await request(testApp)
      .post('/login-test')
      .set('X-Forwarded-For', ip)
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({ email: TEST_USERS.admin.email, password: 'wrong' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('Security headers', () => {
  it('should have Helmet headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    // CSP may be present
  });
});

describe('Password hash never exposed', () => {
  it('should not include passwordHash in login response', async () => {
    const res = await login(TEST_USERS.admin.email, TEST_PASSWORD);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('passwordHash');
    expect(bodyStr).not.toContain('$2b$');
  });

  it('should not include passwordHash in /me response', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', adminCookie!);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('passwordHash');
  });
});
