import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import type { CourseStatus, Role, Weekday } from '../generated/prisma/enums.js';

export const TEST_PASSWORD = 'TestPass123!';

export interface TestUserInput {
  email: string;
  role: Role;
  name?: string;
  isActive?: boolean;
}

export const createTestUser = async (input: TestUserInput) => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);

  return prisma.user.create({
    data: {
      name: input.name ?? `Test ${input.role}`,
      email: input.email,
      passwordHash,
      role: input.role,
      isActive: input.isActive ?? true,
    },
  });
};

export const loginAs = async (email: string): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', env.FRONTEND_ORIGIN)
    .send({ email, password: TEST_PASSWORD });

  if (response.status !== 200) {
    throw new Error(`Login failed for ${email} with status ${response.status}.`);
  }

  const setCookie = response.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookie = cookies.find((value) => value.startsWith(`${env.AUTH_COOKIE_NAME}=`));

  if (!cookie) {
    throw new Error(`Login did not return a session cookie for ${email}.`);
  }

  return cookie;
};

export interface TestCourseInput {
  code: string;
  instructorId: string;
  status?: CourseStatus;
  capacity?: number;
  term?: string;
  scheduleDay?: Weekday;
  startTime?: string;
  endTime?: string;
  title?: string;
}

export const createTestCourse = async (input: TestCourseInput) => {
  return prisma.course.create({
    data: {
      code: input.code,
      title: input.title ?? `Course ${input.code}`,
      description: `Description for ${input.code}`,
      credits: 3,
      capacity: input.capacity ?? 30,
      term: input.term ?? 'Fall 2026',
      scheduleDay: input.scheduleDay ?? 'MONDAY',
      startTime: input.startTime ?? '09:00',
      endTime: input.endTime ?? '10:00',
      room: 'T-100',
      status: input.status ?? 'OPEN',
      instructorId: input.instructorId,
    },
  });
};
