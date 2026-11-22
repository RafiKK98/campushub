import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  createTestCourse,
  createTestUser,
  loginAs,
  type TestCourseInput,
} from '../../test/helpers.js';

const RUN_ID = randomUUID().slice(0, 8);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_PREFIX = `T${LETTERS[randomInt(LETTERS.length)]}${LETTERS[randomInt(LETTERS.length)]}`;
const EMAIL_PREFIX = `m3-test-${RUN_ID}`;
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
let studentBCookie: string;

let openCourse: Awaited<ReturnType<typeof createTestCourse>>;
let otherOpenCourse: Awaited<ReturnType<typeof createTestCourse>>;
let draftCourse: Awaited<ReturnType<typeof createTestCourse>>;
let otherDraftCourse: Awaited<ReturnType<typeof createTestCourse>>;
let closedCourse: Awaited<ReturnType<typeof createTestCourse>>;
let closedEnrolledCourse: Awaited<ReturnType<typeof createTestCourse>>;
let fullCourse: Awaited<ReturnType<typeof createTestCourse>>;
let capacityCourse: Awaited<ReturnType<typeof createTestCourse>>;
let deletableCourse: Awaited<ReturnType<typeof createTestCourse>>;
let deleteWithEnrollmentCourse: Awaited<ReturnType<typeof createTestCourse>>;
let assignmentCourse: Awaited<ReturnType<typeof createTestCourse>>;
let rosterCourse: Awaited<ReturnType<typeof createTestCourse>>;

const createCourseFor = (
  instructorId: string,
  overrides: Partial<Omit<TestCourseInput, 'code' | 'instructorId'>> = {},
) => createTestCourse({ code: nextCode(), instructorId, ...overrides });

const coursePayload = (
  code: string,
  instructorId: string,
  overrides: Record<string, unknown> = {},
) => ({
  code,
  title: `Title ${code}`,
  description: `Description for ${code}`,
  credits: 3,
  capacity: 20,
  term: 'Fall 2026',
  scheduleDay: 'MONDAY',
  startTime: '09:00',
  endTime: '10:00',
  room: 'T-101',
  instructorId,
  ...overrides,
});

beforeAll(async () => {
  [admin, instructorA, instructorB, studentA, studentB, studentC] = await Promise.all([
    createTestUser({ email: emailFor('admin'), role: 'ADMIN', name: 'M3 Admin' }),
    createTestUser({
      email: emailFor('instructor-a'),
      role: 'INSTRUCTOR',
      name: 'M3 Instructor A',
    }),
    createTestUser({
      email: emailFor('instructor-b'),
      role: 'INSTRUCTOR',
      name: 'M3 Instructor B',
    }),
    createTestUser({ email: emailFor('student-a'), role: 'STUDENT', name: 'M3 Student A' }),
    createTestUser({ email: emailFor('student-b'), role: 'STUDENT', name: 'M3 Student B' }),
    createTestUser({ email: emailFor('student-c'), role: 'STUDENT', name: 'M3 Student C' }),
  ]);

  [adminCookie, instructorACookie, instructorBCookie, studentACookie, studentBCookie] =
    await Promise.all([
      loginAs(admin.email),
      loginAs(instructorA.email),
      loginAs(instructorB.email),
      loginAs(studentA.email),
      loginAs(studentB.email),
    ]);

  [openCourse, otherOpenCourse, draftCourse, otherDraftCourse, closedCourse, closedEnrolledCourse] =
    await Promise.all([
      createTestCourse({ code: nextCode(), instructorId: instructorA.id, capacity: 5 }),
      createTestCourse({ code: nextCode(), instructorId: instructorB.id, capacity: 5 }),
      createTestCourse({ code: nextCode(), instructorId: instructorA.id, status: 'DRAFT' }),
      createTestCourse({ code: nextCode(), instructorId: instructorB.id, status: 'DRAFT' }),
      createTestCourse({ code: nextCode(), instructorId: instructorA.id, status: 'CLOSED' }),
      createTestCourse({ code: nextCode(), instructorId: instructorA.id, status: 'CLOSED' }),
    ]);

  [fullCourse, capacityCourse, deletableCourse, assignmentCourse, rosterCourse] = await Promise.all(
    [
      createTestCourse({ code: nextCode(), instructorId: instructorA.id, capacity: 1 }),
      createTestCourse({ code: nextCode(), instructorId: instructorA.id, capacity: 5 }),
      createTestCourse({ code: nextCode(), instructorId: instructorA.id, capacity: 5 }),
      createTestCourse({ code: nextCode(), instructorId: instructorA.id, capacity: 5 }),
      createTestCourse({ code: nextCode(), instructorId: instructorA.id, capacity: 5 }),
    ],
  );

  deleteWithEnrollmentCourse = await createTestCourse({
    code: nextCode(),
    instructorId: instructorA.id,
    capacity: 5,
  });

  await prisma.enrollment.createMany({
    data: [
      { studentId: studentC.id, courseId: fullCourse.id, status: 'ENROLLED' },
      { studentId: studentA.id, courseId: capacityCourse.id, status: 'ENROLLED' },
      { studentId: studentB.id, courseId: capacityCourse.id, status: 'ENROLLED' },
      { studentId: studentA.id, courseId: closedEnrolledCourse.id, status: 'ENROLLED' },
      { studentId: studentA.id, courseId: deleteWithEnrollmentCourse.id, status: 'ENROLLED' },
      { studentId: studentA.id, courseId: rosterCourse.id, status: 'ENROLLED' },
      { studentId: studentB.id, courseId: rosterCourse.id, status: 'DROPPED' },
    ],
  });

  await prisma.assignment.create({
    data: {
      courseId: assignmentCourse.id,
      title: 'M3 dependency assignment',
      description: 'Used to verify course deletion protection.',
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxScore: 100,
    },
  });
}, 30_000);

afterAll(async () => {
  await prisma.course.deleteMany({ where: { code: { startsWith: `${CODE_PREFIX}-` } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `${EMAIL_PREFIX}-` } } });
  await prisma.$disconnect();
}, 30_000);

describe('Course authorization and validation', () => {
  it('requires authentication for the course catalogue', async () => {
    const response = await request(app).get('/api/v1/courses');
    expect(response.status).toBe(401);
  });

  it('forbids non-admin users from creating courses', async () => {
    const payload = coursePayload(nextCode(), instructorA.id);

    const studentResponse = await request(app)
      .post('/api/v1/admin/courses')
      .set('Cookie', studentACookie)
      .send(payload);
    expect(studentResponse.status).toBe(403);

    const instructorResponse = await request(app)
      .post('/api/v1/admin/courses')
      .set('Cookie', instructorACookie)
      .send(payload);
    expect(instructorResponse.status).toBe(403);
  });

  it('validates course create input', async () => {
    const missingFields = await request(app)
      .post('/api/v1/admin/courses')
      .set('Cookie', adminCookie)
      .send({ code: nextCode() });
    expect(missingFields.status).toBe(400);
    expect(missingFields.body.error.code).toBe('VALIDATION_ERROR');

    const invalidTime = await request(app)
      .post('/api/v1/admin/courses')
      .set('Cookie', adminCookie)
      .send(coursePayload(nextCode(), instructorA.id, { startTime: '11:00', endTime: '10:00' }));
    expect(invalidTime.status).toBe(400);
    expect(invalidTime.body.error.code).toBe('VALIDATION_ERROR');

    const invalidInstructor = await request(app)
      .post('/api/v1/admin/courses')
      .set('Cookie', adminCookie)
      .send(coursePayload(nextCode(), studentA.id));
    expect(invalidInstructor.status).toBe(400);
    expect(invalidInstructor.body.error.code).toBe('INVALID_INSTRUCTOR');
  });

  it('creates a course with normalized values and safe response fields', async () => {
    const code = nextCode().toLowerCase();
    const response = await request(app)
      .post('/api/v1/admin/courses')
      .set('Cookie', adminCookie)
      .send(coursePayload(code, instructorA.id));

    expect(response.status).toBe(201);
    expect(response.body.data.course.code).toBe(code.toUpperCase());
    expect(response.body.data.course.status).toBe('DRAFT');
    expect(response.body.data.course.enrolledCount).toBe(0);
    expect(response.body.data.course.availableSeats).toBe(20);
    expect(response.body.data.course.instructor.id).toBe(instructorA.id);
    expect(response.body.data.course).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('$2b$');
  });

  it('rejects duplicate course codes', async () => {
    const response = await request(app)
      .post('/api/v1/admin/courses')
      .set('Cookie', adminCookie)
      .send(coursePayload(openCourse.code, instructorA.id));

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('COURSE_CODE_EXISTS');
  });

  it('rejects invalid and missing course identifiers', async () => {
    const invalid = await request(app)
      .get('/api/v1/courses/not-a-uuid')
      .set('Cookie', studentACookie);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app)
      .get(`/api/v1/courses/${randomUUID()}`)
      .set('Cookie', studentACookie);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('COURSE_NOT_FOUND');
  });
});

describe('Course listing and visibility', () => {
  it('lets admins see every course status and filter/paginate results', async () => {
    const response = await request(app)
      .get('/api/v1/courses')
      .query({ page: 1, limit: 100 })
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    const codes = response.body.data.courses.map((course: { code: string }) => course.code);
    expect(codes).toContain(draftCourse.code);
    expect(codes).toContain(closedCourse.code);
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.limit).toBe(100);
    expect(response.body.meta.total).toBeGreaterThanOrEqual(2);

    const draftOnly = await request(app)
      .get('/api/v1/courses')
      .query({ status: 'DRAFT' })
      .set('Cookie', adminCookie);
    expect(draftOnly.status).toBe(200);
    expect(
      draftOnly.body.data.courses.every((course: { status: string }) => course.status === 'DRAFT'),
    ).toBe(true);

    const search = await request(app)
      .get('/api/v1/courses')
      .query({ search: openCourse.code, term: openCourse.term })
      .set('Cookie', adminCookie);
    expect(search.status).toBe(200);
    expect(
      search.body.data.courses.some((course: { code: string }) => course.code === openCourse.code),
    ).toBe(true);

    const adminEndpoint = await request(app)
      .get('/api/v1/admin/courses')
      .query({ limit: 100 })
      .set('Cookie', adminCookie);
    expect(adminEndpoint.status).toBe(200);

    const wrongRole = await request(app)
      .get('/api/v1/admin/courses')
      .set('Cookie', instructorACookie);
    expect(wrongRole.status).toBe(403);
  });

  it('restricts students to open courses', async () => {
    const response = await request(app)
      .get('/api/v1/courses')
      .query({ limit: 100 })
      .set('Cookie', studentACookie);

    expect(response.status).toBe(200);
    const codes = response.body.data.courses.map((course: { code: string }) => course.code);
    expect(codes).toContain(openCourse.code);
    expect(codes).not.toContain(draftCourse.code);
    expect(codes).not.toContain(closedCourse.code);

    const forbiddenFilter = await request(app)
      .get('/api/v1/courses')
      .query({ status: 'DRAFT' })
      .set('Cookie', studentACookie);
    expect(forbiddenFilter.status).toBe(400);
    expect(forbiddenFilter.body.error.code).toBe('INVALID_FILTER');
  });

  it('limits instructors to their own courses', async () => {
    const response = await request(app)
      .get('/api/v1/instructor/courses')
      .query({ limit: 100 })
      .set('Cookie', instructorACookie);

    expect(response.status).toBe(200);
    const codes = response.body.data.courses.map((course: { code: string }) => course.code);
    expect(codes).toContain(draftCourse.code);
    expect(codes).not.toContain(otherDraftCourse.code);
    expect(codes).not.toContain(otherOpenCourse.code);
  });

  it('paginates course results', async () => {
    const response = await request(app)
      .get('/api/v1/courses')
      .query({ page: 1, limit: 2 })
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.courses.length).toBeLessThanOrEqual(2);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 2 });
    expect(response.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('applies role-aware course detail visibility', async () => {
    const studentOpen = await request(app)
      .get(`/api/v1/courses/${openCourse.id}`)
      .set('Cookie', studentACookie);
    expect(studentOpen.status).toBe(200);

    const studentDraft = await request(app)
      .get(`/api/v1/courses/${draftCourse.id}`)
      .set('Cookie', studentACookie);
    expect(studentDraft.status).toBe(404);

    const studentClosed = await request(app)
      .get(`/api/v1/courses/${closedCourse.id}`)
      .set('Cookie', studentACookie);
    expect(studentClosed.status).toBe(404);

    const studentClosedEnrolled = await request(app)
      .get(`/api/v1/courses/${closedEnrolledCourse.id}`)
      .set('Cookie', studentACookie);
    expect(studentClosedEnrolled.status).toBe(200);

    const instructorOwnDraft = await request(app)
      .get(`/api/v1/courses/${draftCourse.id}`)
      .set('Cookie', instructorACookie);
    expect(instructorOwnDraft.status).toBe(200);

    const instructorOtherDraft = await request(app)
      .get(`/api/v1/courses/${otherDraftCourse.id}`)
      .set('Cookie', instructorACookie);
    expect(instructorOtherDraft.status).toBe(404);

    const instructorOtherOpen = await request(app)
      .get(`/api/v1/courses/${otherOpenCourse.id}`)
      .set('Cookie', instructorACookie);
    expect(instructorOtherOpen.status).toBe(200);

    const adminDraft = await request(app)
      .get(`/api/v1/courses/${draftCourse.id}`)
      .set('Cookie', adminCookie);
    expect(adminDraft.status).toBe(200);
  });

  it('never exposes password hashes through course responses', async () => {
    const detail = await request(app)
      .get(`/api/v1/courses/${openCourse.id}`)
      .set('Cookie', adminCookie);

    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toContain('passwordHash');
    expect(JSON.stringify(detail.body)).not.toContain('$2b$');
  });
});

describe('Course updates', () => {
  it('updates course fields as admin', async () => {
    const course = await createCourseFor(instructorA.id);
    const response = await request(app)
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set('Cookie', adminCookie)
      .send({ title: 'Updated title', capacity: 25 });

    expect(response.status).toBe(200);
    expect(response.body.data.course.title).toBe('Updated title');
    expect(response.body.data.course.capacity).toBe(25);
  });

  it('prevents capacity from dropping below enrolled students', async () => {
    const course = await createCourseFor(instructorA.id, { capacity: 5 });
    await prisma.enrollment.createMany({
      data: [
        { studentId: studentA.id, courseId: course.id, status: 'ENROLLED' },
        { studentId: studentB.id, courseId: course.id, status: 'ENROLLED' },
      ],
    });

    const response = await request(app)
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set('Cookie', adminCookie)
      .send({ capacity: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CAPACITY_BELOW_ENROLLED');
  });

  it('validates update payloads and instructors', async () => {
    const course = await createCourseFor(instructorA.id);

    const empty = await request(app)
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set('Cookie', adminCookie)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const invalidInstructor = await request(app)
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set('Cookie', adminCookie)
      .send({ instructorId: studentA.id });
    expect(invalidInstructor.status).toBe(400);
    expect(invalidInstructor.body.error.code).toBe('INVALID_INSTRUCTOR');

    const invalidTime = await request(app)
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set('Cookie', adminCookie)
      .send({ startTime: '11:00', endTime: '10:00' });
    expect(invalidTime.status).toBe(400);
  });

  it('rejects duplicate codes during updates', async () => {
    const first = await createCourseFor(instructorA.id);
    const second = await createCourseFor(instructorA.id);

    const response = await request(app)
      .patch(`/api/v1/admin/courses/${first.id}`)
      .set('Cookie', adminCookie)
      .send({ code: second.code });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('COURSE_CODE_EXISTS');
  });

  it('updates course status and forbids non-admin mutations', async () => {
    const course = await createCourseFor(instructorA.id);

    const statusResponse = await request(app)
      .patch(`/api/v1/admin/courses/${course.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'CLOSED' });
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.course.status).toBe('CLOSED');

    const instructorResponse = await request(app)
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set('Cookie', instructorACookie)
      .send({ title: 'Forbidden' });
    expect(instructorResponse.status).toBe(403);

    const studentResponse = await request(app)
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set('Cookie', studentACookie)
      .send({ title: 'Forbidden' });
    expect(studentResponse.status).toBe(403);
  });
});

describe('Course deletion', () => {
  it('deletes a course without dependencies', async () => {
    const response = await request(app)
      .delete(`/api/v1/admin/courses/${deletableCourse.id}`)
      .set('Cookie', adminCookie);
    expect(response.status).toBe(204);

    const missing = await request(app)
      .get(`/api/v1/courses/${deletableCourse.id}`)
      .set('Cookie', adminCookie);
    expect(missing.status).toBe(404);

    const repeated = await request(app)
      .delete(`/api/v1/admin/courses/${deletableCourse.id}`)
      .set('Cookie', adminCookie);
    expect(repeated.status).toBe(404);
  });

  it('blocks deletion when enrollments exist', async () => {
    const response = await request(app)
      .delete(`/api/v1/admin/courses/${deleteWithEnrollmentCourse.id}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('COURSE_HAS_DEPENDENCIES');
  });

  it('blocks deletion when assignments exist', async () => {
    const response = await request(app)
      .delete(`/api/v1/admin/courses/${assignmentCourse.id}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('COURSE_HAS_DEPENDENCIES');
  });

  it('forbids non-admin deletion', async () => {
    const instructorResponse = await request(app)
      .delete(`/api/v1/admin/courses/${openCourse.id}`)
      .set('Cookie', instructorACookie);
    expect(instructorResponse.status).toBe(403);

    const studentResponse = await request(app)
      .delete(`/api/v1/admin/courses/${openCourse.id}`)
      .set('Cookie', studentACookie);
    expect(studentResponse.status).toBe(403);
  });
});

describe('Enrollment', () => {
  it('enrolls the authenticated student and ignores body ownership', async () => {
    const course = await createCourseFor(instructorA.id, { capacity: 5 });

    const response = await request(app)
      .post(`/api/v1/courses/${course.id}/enroll`)
      .set('Cookie', studentACookie)
      .send({ studentId: studentB.id });

    expect(response.status).toBe(201);
    expect(response.body.data.enrollment.status).toBe('ENROLLED');
    expect(response.body.data.enrollment.courseId).toBe(course.id);
    expect(response.body.data.enrollment).not.toHaveProperty('studentId');

    const studentAEnrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: studentA.id, courseId: course.id } },
    });
    const studentBEnrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: studentB.id, courseId: course.id } },
    });
    expect(studentAEnrollment?.status).toBe('ENROLLED');
    expect(studentBEnrollment).toBeNull();

    const duplicate = await request(app)
      .post(`/api/v1/courses/${course.id}/enroll`)
      .set('Cookie', studentACookie);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('ALREADY_ENROLLED');
  });

  it('rejects enrollment in courses that are not open or are full', async () => {
    const draft = await createCourseFor(instructorA.id, { status: 'DRAFT' });
    const closed = await createCourseFor(instructorA.id, { status: 'CLOSED' });

    const draftResponse = await request(app)
      .post(`/api/v1/courses/${draft.id}/enroll`)
      .set('Cookie', studentACookie);
    expect(draftResponse.status).toBe(409);
    expect(draftResponse.body.error.code).toBe('COURSE_NOT_OPEN');

    const closedResponse = await request(app)
      .post(`/api/v1/courses/${closed.id}/enroll`)
      .set('Cookie', studentACookie);
    expect(closedResponse.status).toBe(409);
    expect(closedResponse.body.error.code).toBe('COURSE_NOT_OPEN');

    const fullResponse = await request(app)
      .post(`/api/v1/courses/${fullCourse.id}/enroll`)
      .set('Cookie', studentACookie);
    expect(fullResponse.status).toBe(409);
    expect(fullResponse.body.error.code).toBe('COURSE_FULL');
  });

  it('validates enrollment identifiers and roles', async () => {
    const missing = await request(app)
      .post(`/api/v1/courses/${randomUUID()}/enroll`)
      .set('Cookie', studentACookie);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('COURSE_NOT_FOUND');

    const invalid = await request(app)
      .post('/api/v1/courses/not-a-uuid/enroll')
      .set('Cookie', studentACookie);
    expect(invalid.status).toBe(400);

    const unauthenticated = await request(app).post(`/api/v1/courses/${openCourse.id}/enroll`);
    expect(unauthenticated.status).toBe(401);

    const instructor = await request(app)
      .post(`/api/v1/courses/${openCourse.id}/enroll`)
      .set('Cookie', instructorACookie);
    expect(instructor.status).toBe(403);

    const admin = await request(app)
      .post(`/api/v1/courses/${openCourse.id}/enroll`)
      .set('Cookie', adminCookie);
    expect(admin.status).toBe(403);
  });

  it('drops, re-enrolls, and reports missing enrollments', async () => {
    const course = await createCourseFor(instructorA.id, { capacity: 5 });

    const enroll = await request(app)
      .post(`/api/v1/courses/${course.id}/enroll`)
      .set('Cookie', studentACookie);
    expect(enroll.status).toBe(201);

    const drop = await request(app)
      .delete(`/api/v1/courses/${course.id}/enroll`)
      .set('Cookie', studentACookie);
    expect(drop.status).toBe(204);

    const dropAgain = await request(app)
      .delete(`/api/v1/courses/${course.id}/enroll`)
      .set('Cookie', studentACookie);
    expect(dropAgain.status).toBe(204);

    const reEnroll = await request(app)
      .post(`/api/v1/courses/${course.id}/enroll`)
      .set('Cookie', studentACookie);
    expect(reEnroll.status).toBe(201);

    const notEnrolled = await request(app)
      .delete(`/api/v1/courses/${course.id}/enroll`)
      .set('Cookie', studentBCookie);
    expect(notEnrolled.status).toBe(404);
    expect(notEnrolled.body.error.code).toBe('ENROLLMENT_NOT_FOUND');
  });

  it('enforces capacity under concurrent enrollment attempts', async () => {
    const course = await createCourseFor(instructorA.id, { capacity: 1 });

    const responses = await Promise.all([
      request(app).post(`/api/v1/courses/${course.id}/enroll`).set('Cookie', studentACookie),
      request(app).post(`/api/v1/courses/${course.id}/enroll`).set('Cookie', studentBCookie),
    ]);

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 409]);

    const enrolledCount = await prisma.enrollment.count({
      where: { courseId: course.id, status: 'ENROLLED' },
    });
    expect(enrolledCount).toBe(1);
  });

  it('rejects sessions for inactive or deleted users', async () => {
    const inactive = await createTestUser({
      email: emailFor('inactive-student'),
      role: 'STUDENT',
    });
    const inactiveCookie = await loginAs(inactive.email);
    await prisma.user.update({ where: { id: inactive.id }, data: { isActive: false } });

    const inactiveResponse = await request(app)
      .get('/api/v1/student/courses')
      .set('Cookie', inactiveCookie);
    expect(inactiveResponse.status).toBe(401);

    const deleted = await createTestUser({
      email: emailFor('deleted-student'),
      role: 'STUDENT',
    });
    const deletedCookie = await loginAs(deleted.email);
    await prisma.user.delete({ where: { id: deleted.id } });

    const deletedResponse = await request(app)
      .get('/api/v1/student/courses')
      .set('Cookie', deletedCookie);
    expect(deletedResponse.status).toBe(401);
  });
});

describe('Student courses and rosters', () => {
  it('lists only the student’s enrolled courses with filters', async () => {
    const ownCourse = await createCourseFor(instructorA.id, { capacity: 5, term: 'Spring 2027' });
    const otherCourse = await createCourseFor(instructorA.id, { capacity: 5, term: 'Spring 2027' });

    await prisma.enrollment.createMany({
      data: [
        { studentId: studentA.id, courseId: ownCourse.id, status: 'ENROLLED' },
        { studentId: studentB.id, courseId: otherCourse.id, status: 'ENROLLED' },
      ],
    });

    const response = await request(app)
      .get('/api/v1/student/courses')
      .query({ search: ownCourse.code, term: 'Spring 2027' })
      .set('Cookie', studentACookie);

    expect(response.status).toBe(200);
    const codes = response.body.data.courses.map((course: { code: string }) => course.code);
    expect(codes).toContain(ownCourse.code);
    expect(codes).not.toContain(otherCourse.code);
    expect(response.body.meta.page).toBe(1);

    const pagination = await request(app)
      .get('/api/v1/student/courses')
      .query({ page: 1, limit: 1 })
      .set('Cookie', studentACookie);
    expect(pagination.status).toBe(200);
    expect(pagination.body.data.courses.length).toBeLessThanOrEqual(1);

    await prisma.enrollment.update({
      where: { studentId_courseId: { studentId: studentA.id, courseId: ownCourse.id } },
      data: { status: 'DROPPED' },
    });

    const afterDrop = await request(app)
      .get('/api/v1/student/courses')
      .query({ search: ownCourse.code })
      .set('Cookie', studentACookie);
    expect(afterDrop.status).toBe(200);
    expect(afterDrop.body.data.courses).toHaveLength(0);
  });

  it('returns rosters to admins and the owning instructor only', async () => {
    const instructorResponse = await request(app)
      .get(`/api/v1/instructor/courses/${rosterCourse.id}/roster`)
      .set('Cookie', instructorACookie);
    expect(instructorResponse.status).toBe(200);
    expect(instructorResponse.body.data.enrollments).toHaveLength(1);
    expect(instructorResponse.body.data.enrollments[0].student.id).toBe(studentA.id);
    expect(JSON.stringify(instructorResponse.body)).not.toContain('passwordHash');

    const adminResponse = await request(app)
      .get(`/api/v1/admin/courses/${rosterCourse.id}/roster`)
      .set('Cookie', adminCookie);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.enrollments).toHaveLength(1);

    const otherInstructor = await request(app)
      .get(`/api/v1/instructor/courses/${rosterCourse.id}/roster`)
      .set('Cookie', instructorBCookie);
    expect(otherInstructor.status).toBe(403);

    const studentResponse = await request(app)
      .get(`/api/v1/instructor/courses/${rosterCourse.id}/roster`)
      .set('Cookie', studentACookie);
    expect(studentResponse.status).toBe(403);
  });

  it('filters and paginates roster results', async () => {
    const dropped = await request(app)
      .get(`/api/v1/instructor/courses/${rosterCourse.id}/roster`)
      .query({ status: 'DROPPED' })
      .set('Cookie', instructorACookie);

    expect(dropped.status).toBe(200);
    expect(dropped.body.data.enrollments).toHaveLength(1);
    expect(dropped.body.data.enrollments[0].student.id).toBe(studentB.id);

    const search = await request(app)
      .get(`/api/v1/admin/courses/${rosterCourse.id}/roster`)
      .query({ search: studentA.email })
      .set('Cookie', adminCookie);
    expect(search.status).toBe(200);
    expect(search.body.data.enrollments).toHaveLength(1);

    const pagination = await request(app)
      .get(`/api/v1/admin/courses/${rosterCourse.id}/roster`)
      .query({ page: 1, limit: 1 })
      .set('Cookie', adminCookie);
    expect(pagination.status).toBe(200);
    expect(pagination.body.data.enrollments).toHaveLength(1);
    expect(pagination.body.meta).toMatchObject({ page: 1, limit: 1, total: 1, totalPages: 1 });

    const missing = await request(app)
      .get(`/api/v1/admin/courses/${randomUUID()}/roster`)
      .set('Cookie', adminCookie);
    expect(missing.status).toBe(404);
  });
});
