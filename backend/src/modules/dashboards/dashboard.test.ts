import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  createTestAnnouncement,
  createTestAssignment,
  createTestCourse,
  createTestSubmission,
  createTestUser,
  loginAs,
} from '../../test/helpers.js';

const RUN_ID = randomUUID().slice(0, 8);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_PREFIX = `D${LETTERS[randomInt(LETTERS.length)]}${LETTERS[randomInt(LETTERS.length)]}`;
const EMAIL_PREFIX = `m6-dash-${RUN_ID}`;
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
let studentACookie: string;
let studentCCookie: string;

let courseA: Awaited<ReturnType<typeof createTestCourse>>;
let courseB: Awaited<ReturnType<typeof createTestCourse>>;
let courseC: Awaited<ReturnType<typeof createTestCourse>>;

let assignmentA1: Awaited<ReturnType<typeof createTestAssignment>>;
let assignmentA2: Awaited<ReturnType<typeof createTestAssignment>>;
let assignmentB1: Awaited<ReturnType<typeof createTestAssignment>>;
let assignmentC1: Awaited<ReturnType<typeof createTestAssignment>>;

let globalAnnouncement: Awaited<ReturnType<typeof createTestAnnouncement>>;
let courseAAnnouncement: Awaited<ReturnType<typeof createTestAnnouncement>>;
let courseBAnnouncement: Awaited<ReturnType<typeof createTestAnnouncement>>;
let courseCAnnouncement: Awaited<ReturnType<typeof createTestAnnouncement>>;

const now = Date.now();
const inDays = (days: number) => new Date(now + days * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  [admin, instructorA, instructorB, studentA, studentB, studentC] = await Promise.all([
    createTestUser({ email: emailFor('admin'), role: 'ADMIN', name: 'M6 Dash Admin' }),
    createTestUser({
      email: emailFor('instructor-a'),
      role: 'INSTRUCTOR',
      name: 'M6 Dash Instructor A',
    }),
    createTestUser({
      email: emailFor('instructor-b'),
      role: 'INSTRUCTOR',
      name: 'M6 Dash Instructor B',
    }),
    createTestUser({ email: emailFor('student-a'), role: 'STUDENT', name: 'M6 Dash Student A' }),
    createTestUser({ email: emailFor('student-b'), role: 'STUDENT', name: 'M6 Dash Student B' }),
    createTestUser({ email: emailFor('student-c'), role: 'STUDENT', name: 'M6 Dash Student C' }),
  ]);

  [adminCookie, instructorACookie, studentACookie, studentCCookie] = await Promise.all([
    loginAs(admin.email),
    loginAs(instructorA.email),
    loginAs(studentA.email),
    loginAs(studentC.email),
  ]);

  [courseA, courseB, courseC] = await Promise.all([
    createTestCourse({ code: nextCode(), instructorId: instructorA.id }),
    createTestCourse({ code: nextCode(), instructorId: instructorB.id }),
    createTestCourse({ code: nextCode(), instructorId: instructorA.id, status: 'CLOSED' }),
  ]);

  await prisma.enrollment.createMany({
    data: [
      { studentId: studentA.id, courseId: courseA.id, status: 'ENROLLED' },
      { studentId: studentA.id, courseId: courseB.id, status: 'ENROLLED' },
      { studentId: studentB.id, courseId: courseA.id, status: 'ENROLLED' },
    ],
  });

  [assignmentA1, assignmentA2, assignmentB1, assignmentC1] = await Promise.all([
    createTestAssignment({ courseId: courseA.id, dueAt: inDays(1), maxScore: 100 }),
    createTestAssignment({ courseId: courseA.id, dueAt: inDays(-1), maxScore: 50 }),
    createTestAssignment({ courseId: courseB.id, dueAt: inDays(2), maxScore: 100 }),
    createTestAssignment({ courseId: courseC.id, dueAt: inDays(3), maxScore: 100 }),
  ]);

  await Promise.all([
    createTestSubmission({
      assignmentId: assignmentA1.id,
      studentId: studentA.id,
      submittedAt: inDays(-1),
      score: 80,
      gradedAt: new Date(),
    }),
    createTestSubmission({
      assignmentId: assignmentA2.id,
      studentId: studentA.id,
      submittedAt: inDays(-2),
      score: 45,
      gradedAt: new Date(),
    }),
    createTestSubmission({
      assignmentId: assignmentB1.id,
      studentId: studentA.id,
      submittedAt: inDays(-1),
    }),
    createTestSubmission({
      assignmentId: assignmentA1.id,
      studentId: studentB.id,
      submittedAt: inDays(-1),
    }),
  ]);

  [globalAnnouncement, courseAAnnouncement, courseBAnnouncement, courseCAnnouncement] =
    await Promise.all([
      createTestAnnouncement({
        authorId: admin.id,
        courseId: null,
        title: `Dashboard global ${RUN_ID}`,
      }),
      createTestAnnouncement({
        authorId: instructorA.id,
        courseId: courseA.id,
        title: `Dashboard course A ${RUN_ID}`,
      }),
      createTestAnnouncement({
        authorId: instructorB.id,
        courseId: courseB.id,
        title: `Dashboard course B ${RUN_ID}`,
      }),
      createTestAnnouncement({
        authorId: instructorA.id,
        courseId: courseC.id,
        title: `Dashboard course C ${RUN_ID}`,
      }),
    ]);
});

afterAll(async () => {
  await prisma.announcement.deleteMany({
    where: {
      OR: [
        { author: { email: { startsWith: `${EMAIL_PREFIX}-` } } },
        { course: { code: { startsWith: `${CODE_PREFIX}-` } } },
      ],
    },
  });
  await prisma.course.deleteMany({ where: { code: { startsWith: `${CODE_PREFIX}-` } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `${EMAIL_PREFIX}-` } } });
  await prisma.$disconnect();
}, 30_000);

describe('Dashboard role boundaries', () => {
  it('requires authentication for every overview endpoint', async () => {
    const adminResponse = await request(app).get('/api/v1/admin/overview');
    const instructorResponse = await request(app).get('/api/v1/instructor/overview');
    const studentResponse = await request(app).get('/api/v1/student/overview');

    expect(adminResponse.status).toBe(401);
    expect(instructorResponse.status).toBe(401);
    expect(studentResponse.status).toBe(401);
  });

  it('forbids non-admins from the admin overview', async () => {
    const instructorResponse = await request(app)
      .get('/api/v1/admin/overview')
      .set('Cookie', instructorACookie);
    const studentResponse = await request(app)
      .get('/api/v1/admin/overview')
      .set('Cookie', studentACookie);

    expect(instructorResponse.status).toBe(403);
    expect(studentResponse.status).toBe(403);
  });

  it('forbids non-instructors from the instructor overview', async () => {
    const adminResponse = await request(app)
      .get('/api/v1/instructor/overview')
      .set('Cookie', adminCookie);
    const studentResponse = await request(app)
      .get('/api/v1/instructor/overview')
      .set('Cookie', studentACookie);

    expect(adminResponse.status).toBe(403);
    expect(studentResponse.status).toBe(403);
  });

  it('forbids non-students from the student overview', async () => {
    const adminResponse = await request(app)
      .get('/api/v1/student/overview')
      .set('Cookie', adminCookie);
    const instructorResponse = await request(app)
      .get('/api/v1/student/overview')
      .set('Cookie', instructorACookie);

    expect(adminResponse.status).toBe(403);
    expect(instructorResponse.status).toBe(403);
  });
});

describe('Instructor overview', () => {
  it('returns scoped course and activity counts for the instructor', async () => {
    const response = await request(app)
      .get('/api/v1/instructor/overview')
      .set('Cookie', instructorACookie);

    expect(response.status).toBe(200);

    const overview = response.body.data.overview;
    expect(overview.totalCourses).toBe(2);
    expect(overview.totalStudents).toBe(2);
    expect(overview.totalAssignments).toBe(3);
    expect(overview.pendingGrading).toBe(1);
    expect(overview.gradedSubmissions).toBe(2);

    const courseIds = overview.courses.map((course: { id: string }) => course.id);
    expect(courseIds).toContain(courseA.id);
    expect(courseIds).toContain(courseC.id);
    expect(courseIds).not.toContain(courseB.id);
  });
});

describe('Student overview', () => {
  it('returns enrolled courses, upcoming assignments, announcements, and grades', async () => {
    const response = await request(app)
      .get('/api/v1/student/overview')
      .set('Cookie', studentACookie);

    expect(response.status).toBe(200);

    const overview = response.body.data.overview;
    expect(overview.enrolledCoursesCount).toBe(2);

    const courseIds = overview.courses.map((course: { id: string }) => course.id);
    expect(courseIds).toContain(courseA.id);
    expect(courseIds).toContain(courseB.id);
    expect(courseIds).not.toContain(courseC.id);

    expect(overview.upcomingAssignments).toHaveLength(2);
    expect(overview.upcomingAssignments[0].id).toBe(assignmentA1.id);
    expect(overview.upcomingAssignments[0].submission.grade).toBe(80);
    expect(overview.upcomingAssignments[1].id).toBe(assignmentB1.id);
    expect(overview.upcomingAssignments[1].submission.gradedAt).toBeNull();

    const assignmentIds = overview.upcomingAssignments.map(
      (assignment: { id: string }) => assignment.id,
    );
    expect(assignmentIds).not.toContain(assignmentA2.id);
    expect(assignmentIds).not.toContain(assignmentC1.id);

    expect(overview.gradeSummary.gradedSubmissions).toBe(2);
    expect(overview.gradeSummary.averagePercentage).toBe(85);

    const announcementIds = overview.recentAnnouncements.map(
      (announcement: { id: string }) => announcement.id,
    );
    expect(announcementIds).toContain(globalAnnouncement.id);
    expect(announcementIds).toContain(courseAAnnouncement.id);
    expect(announcementIds).toContain(courseBAnnouncement.id);
    expect(announcementIds).not.toContain(courseCAnnouncement.id);
  });

  it('returns empty state for a student with no enrollments', async () => {
    const response = await request(app)
      .get('/api/v1/student/overview')
      .set('Cookie', studentCCookie);

    expect(response.status).toBe(200);

    const overview = response.body.data.overview;
    expect(overview.enrolledCoursesCount).toBe(0);
    expect(overview.courses).toEqual([]);
    expect(overview.upcomingAssignments).toEqual([]);
    expect(overview.gradeSummary.gradedSubmissions).toBe(0);
    expect(overview.gradeSummary.averagePercentage).toBeNull();

    const announcementIds = overview.recentAnnouncements.map(
      (announcement: { id: string }) => announcement.id,
    );
    expect(announcementIds).toContain(globalAnnouncement.id);
    expect(announcementIds).not.toContain(courseAAnnouncement.id);
    expect(announcementIds).not.toContain(courseBAnnouncement.id);
    expect(announcementIds).not.toContain(courseCAnnouncement.id);
  });
});

describe('Admin overview', () => {
  it('counts students, instructors, active courses, and enrollments', async () => {
    const before = await request(app).get('/api/v1/admin/overview').set('Cookie', adminCookie);
    expect(before.status).toBe(200);

    const deltaInstructor = await createTestUser({
      email: emailFor('delta-instructor'),
      role: 'INSTRUCTOR',
      name: 'M6 Dash Delta Instructor',
    });
    const deltaStudent = await createTestUser({
      email: emailFor('delta-student'),
      role: 'STUDENT',
      name: 'M6 Dash Delta Student',
    });
    const deltaCourse = await createTestCourse({
      code: nextCode(),
      instructorId: deltaInstructor.id,
    });
    await prisma.enrollment.create({
      data: { studentId: deltaStudent.id, courseId: deltaCourse.id, status: 'ENROLLED' },
    });

    const after = await request(app).get('/api/v1/admin/overview').set('Cookie', adminCookie);
    expect(after.status).toBe(200);

    expect(after.body.data.overview.totalStudents).toBe(
      before.body.data.overview.totalStudents + 1,
    );
    expect(after.body.data.overview.totalInstructors).toBe(
      before.body.data.overview.totalInstructors + 1,
    );
    expect(after.body.data.overview.activeCourses).toBe(
      before.body.data.overview.activeCourses + 1,
    );
    expect(after.body.data.overview.totalEnrollments).toBe(
      before.body.data.overview.totalEnrollments + 1,
    );
  });
});
