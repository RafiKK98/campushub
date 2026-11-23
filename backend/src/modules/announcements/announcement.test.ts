import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  createTestAnnouncement,
  createTestCourse,
  createTestUser,
  loginAs,
} from '../../test/helpers.js';

const RUN_ID = randomUUID().slice(0, 8);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_PREFIX = `N${LETTERS[randomInt(LETTERS.length)]}${LETTERS[randomInt(LETTERS.length)]}`;
const EMAIL_PREFIX = `m6-ann-${RUN_ID}`;
const emailFor = (label: string) => `${EMAIL_PREFIX}-${label}@campushub.test`;

let codeSequence = 1000;
const nextCode = () => `${CODE_PREFIX}-${++codeSequence}`;

let admin: Awaited<ReturnType<typeof createTestUser>>;
let instructorA: Awaited<ReturnType<typeof createTestUser>>;
let instructorB: Awaited<ReturnType<typeof createTestUser>>;
let studentA: Awaited<ReturnType<typeof createTestUser>>;
let studentB: Awaited<ReturnType<typeof createTestUser>>;
let studentC: Awaited<ReturnType<typeof createTestUser>>;

let adminCookie: string;
let instructorACookie: string;
let instructorBCookie: string;
let studentACookie: string;
let studentCCookie: string;

let courseA: Awaited<ReturnType<typeof createTestCourse>>;
let courseB: Awaited<ReturnType<typeof createTestCourse>>;

let globalAnnouncement: Awaited<ReturnType<typeof createTestAnnouncement>>;
let courseAAnnouncement: Awaited<ReturnType<typeof createTestAnnouncement>>;
let courseBAnnouncement: Awaited<ReturnType<typeof createTestAnnouncement>>;

beforeAll(async () => {
  [admin, instructorA, instructorB, studentA, studentB, studentC] = await Promise.all([
    createTestUser({ email: emailFor('admin'), role: 'ADMIN', name: 'M6 Ann Admin' }),
    createTestUser({
      email: emailFor('instructor-a'),
      role: 'INSTRUCTOR',
      name: 'M6 Ann Instructor A',
    }),
    createTestUser({
      email: emailFor('instructor-b'),
      role: 'INSTRUCTOR',
      name: 'M6 Ann Instructor B',
    }),
    createTestUser({ email: emailFor('student-a'), role: 'STUDENT', name: 'M6 Ann Student A' }),
    createTestUser({ email: emailFor('student-b'), role: 'STUDENT', name: 'M6 Ann Student B' }),
    createTestUser({ email: emailFor('student-c'), role: 'STUDENT', name: 'M6 Ann Student C' }),
  ]);

  [adminCookie, instructorACookie, instructorBCookie, studentACookie, studentCCookie] =
    await Promise.all([
      loginAs(admin.email),
      loginAs(instructorA.email),
      loginAs(instructorB.email),
      loginAs(studentA.email),
      loginAs(studentC.email),
    ]);

  [courseA, courseB] = await Promise.all([
    createTestCourse({ code: nextCode(), instructorId: instructorA.id }),
    createTestCourse({ code: nextCode(), instructorId: instructorB.id }),
  ]);

  await prisma.enrollment.createMany({
    data: [
      { studentId: studentA.id, courseId: courseA.id, status: 'ENROLLED' },
      { studentId: studentB.id, courseId: courseB.id, status: 'ENROLLED' },
    ],
  });

  [globalAnnouncement, courseAAnnouncement, courseBAnnouncement] = await Promise.all([
    createTestAnnouncement({
      authorId: admin.id,
      courseId: null,
      title: `Global ${RUN_ID}`,
    }),
    createTestAnnouncement({
      authorId: instructorA.id,
      courseId: courseA.id,
      title: `Course A ${RUN_ID}`,
    }),
    createTestAnnouncement({
      authorId: instructorB.id,
      courseId: courseB.id,
      title: `Course B ${RUN_ID}`,
    }),
  ]);
});

afterAll(async () => {
  await prisma.announcement.deleteMany({
    where: { author: { email: { startsWith: `${EMAIL_PREFIX}-` } } },
  });
  await prisma.course.deleteMany({ where: { code: { startsWith: `${CODE_PREFIX}-` } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `${EMAIL_PREFIX}-` } } });
  await prisma.$disconnect();
}, 30_000);

describe('Announcement creation authorization', () => {
  it('requires authentication to list announcements', async () => {
    const response = await request(app).get('/api/v1/announcements');
    expect(response.status).toBe(401);
  });

  it('allows admins to create global announcements', async () => {
    const response = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', adminCookie)
      .send({ title: `Admin global ${RUN_ID}`, body: 'Global body' });

    expect(response.status).toBe(201);
    expect(response.body.data.announcement.courseId).toBeNull();
    expect(response.body.data.announcement.course).toBeNull();
    expect(response.body.data.announcement.author.id).toBe(admin.id);
  });

  it('forbids admins from creating course-specific announcements', async () => {
    const response = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', adminCookie)
      .send({ title: 'Admin course post', body: 'Body', courseId: courseA.id });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows instructors to create announcements for their own courses', async () => {
    const response = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', instructorACookie)
      .send({ title: `Instructor course A ${RUN_ID}`, body: 'Body', courseId: courseA.id });

    expect(response.status).toBe(201);
    expect(response.body.data.announcement.courseId).toBe(courseA.id);
    expect(response.body.data.announcement.author.id).toBe(instructorA.id);
  });

  it('forbids instructors from creating global announcements', async () => {
    const response = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', instructorACookie)
      .send({ title: 'Instructor global', body: 'Body' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('COURSE_REQUIRED');
  });

  it('forbids instructors from posting to courses they do not own', async () => {
    const response = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', instructorACookie)
      .send({ title: 'Wrong course', body: 'Body', courseId: courseB.id });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('forbids students from creating announcements', async () => {
    const response = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', studentACookie)
      .send({ title: 'Student post', body: 'Body', courseId: courseA.id });

    expect(response.status).toBe(403);
  });

  it('validates announcement input', async () => {
    const response = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', adminCookie)
      .send({ title: '', body: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when the target course does not exist', async () => {
    const response = await request(app)
      .post('/api/v1/announcements')
      .set('Cookie', instructorACookie)
      .send({ title: 'Missing course', body: 'Body', courseId: randomUUID() });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('COURSE_NOT_FOUND');
  });
});

describe('Announcement visibility', () => {
  it('lets admins see all announcements', async () => {
    const response = await request(app)
      .get('/api/v1/announcements')
      .query({ search: RUN_ID, limit: 100 })
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);

    const ids = response.body.data.announcements.map(
      (announcement: { id: string }) => announcement.id,
    );
    expect(ids).toContain(globalAnnouncement.id);
    expect(ids).toContain(courseAAnnouncement.id);
    expect(ids).toContain(courseBAnnouncement.id);
  });

  it('lets instructors see global and own-course announcements only', async () => {
    const response = await request(app)
      .get('/api/v1/announcements')
      .query({ search: RUN_ID, limit: 100 })
      .set('Cookie', instructorACookie);

    expect(response.status).toBe(200);

    const ids = response.body.data.announcements.map(
      (announcement: { id: string }) => announcement.id,
    );
    expect(ids).toContain(globalAnnouncement.id);
    expect(ids).toContain(courseAAnnouncement.id);
    expect(ids).not.toContain(courseBAnnouncement.id);
  });

  it('lets students see global and enrolled-course announcements only', async () => {
    const response = await request(app)
      .get('/api/v1/announcements')
      .query({ search: RUN_ID, limit: 100 })
      .set('Cookie', studentACookie);

    expect(response.status).toBe(200);

    const ids = response.body.data.announcements.map(
      (announcement: { id: string }) => announcement.id,
    );
    expect(ids).toContain(globalAnnouncement.id);
    expect(ids).toContain(courseAAnnouncement.id);
    expect(ids).not.toContain(courseBAnnouncement.id);
  });

  it('returns an empty list when a student filters an unrelated course', async () => {
    const response = await request(app)
      .get('/api/v1/announcements')
      .query({ courseId: courseB.id, search: RUN_ID })
      .set('Cookie', studentACookie);

    expect(response.status).toBe(200);
    expect(response.body.data.announcements).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  it('shows only global announcements to a student with no enrollments', async () => {
    const response = await request(app)
      .get('/api/v1/announcements')
      .query({ search: RUN_ID, limit: 100 })
      .set('Cookie', studentCCookie);

    expect(response.status).toBe(200);

    const ids = response.body.data.announcements.map(
      (announcement: { id: string }) => announcement.id,
    );
    expect(ids).toContain(globalAnnouncement.id);
    expect(ids).not.toContain(courseAAnnouncement.id);
    expect(ids).not.toContain(courseBAnnouncement.id);
  });

  it('paginates announcement lists with metadata', async () => {
    const response = await request(app)
      .get('/api/v1/announcements')
      .query({ search: RUN_ID, page: 1, limit: 2 })
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.announcements).toHaveLength(2);
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.limit).toBe(2);
    expect(response.body.meta.total).toBeGreaterThanOrEqual(3);
    expect(response.body.meta.totalPages).toBeGreaterThanOrEqual(2);
  });
});

describe('Announcement update and delete permissions', () => {
  it('lets the author update their own announcement', async () => {
    const response = await request(app)
      .patch(`/api/v1/announcements/${courseAAnnouncement.id}`)
      .set('Cookie', instructorACookie)
      .send({ title: `Updated course A ${RUN_ID}` });

    expect(response.status).toBe(200);
    expect(response.body.data.announcement.title).toBe(`Updated course A ${RUN_ID}`);
    expect(response.body.data.announcement.courseId).toBe(courseA.id);
  });

  it('forbids a non-author instructor from updating', async () => {
    const response = await request(app)
      .patch(`/api/v1/announcements/${courseAAnnouncement.id}`)
      .set('Cookie', instructorBCookie)
      .send({ title: 'Hijacked' });

    expect(response.status).toBe(403);
  });

  it('forbids students from updating', async () => {
    const response = await request(app)
      .patch(`/api/v1/announcements/${globalAnnouncement.id}`)
      .set('Cookie', studentACookie)
      .send({ title: 'Student edit' });

    expect(response.status).toBe(403);
  });

  it('rejects an empty update payload', async () => {
    const response = await request(app)
      .patch(`/api/v1/announcements/${globalAnnouncement.id}`)
      .set('Cookie', adminCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lets admins update any announcement', async () => {
    const response = await request(app)
      .patch(`/api/v1/announcements/${courseBAnnouncement.id}`)
      .set('Cookie', adminCookie)
      .send({ body: 'Updated by admin' });

    expect(response.status).toBe(200);
    expect(response.body.data.announcement.body).toBe('Updated by admin');
  });

  it('lets the author delete their own announcement', async () => {
    const announcement = await createTestAnnouncement({
      authorId: instructorA.id,
      courseId: courseA.id,
      title: `Deletable ${RUN_ID}`,
    });

    const response = await request(app)
      .delete(`/api/v1/announcements/${announcement.id}`)
      .set('Cookie', instructorACookie);

    expect(response.status).toBe(204);
    expect(await prisma.announcement.findUnique({ where: { id: announcement.id } })).toBeNull();

    const second = await request(app)
      .delete(`/api/v1/announcements/${announcement.id}`)
      .set('Cookie', instructorACookie);
    expect(second.status).toBe(404);
  });

  it('forbids a non-author instructor from deleting', async () => {
    const announcement = await createTestAnnouncement({
      authorId: instructorA.id,
      courseId: courseA.id,
      title: `Protected ${RUN_ID}`,
    });

    const response = await request(app)
      .delete(`/api/v1/announcements/${announcement.id}`)
      .set('Cookie', instructorBCookie);

    expect(response.status).toBe(403);
    expect(await prisma.announcement.findUnique({ where: { id: announcement.id } })).not.toBeNull();
  });

  it('lets admins delete any announcement', async () => {
    const announcement = await createTestAnnouncement({
      authorId: instructorB.id,
      courseId: courseB.id,
      title: `Admin deletes ${RUN_ID}`,
    });

    const response = await request(app)
      .delete(`/api/v1/announcements/${announcement.id}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(204);
    expect(await prisma.announcement.findUnique({ where: { id: announcement.id } })).toBeNull();
  });

  it('forbids students from deleting', async () => {
    const response = await request(app)
      .delete(`/api/v1/announcements/${globalAnnouncement.id}`)
      .set('Cookie', studentACookie);

    expect(response.status).toBe(403);
  });
});
