import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  createTestAssignment,
  createTestCourse,
  createTestSubmission,
  createTestUser,
  loginAs,
} from '../../test/helpers.js';
import type { CourseStatus } from '../../generated/prisma/enums.js';

const RUN_ID = randomUUID().slice(0, 8);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_PREFIX = `T${LETTERS[randomInt(LETTERS.length)]}${LETTERS[randomInt(LETTERS.length)]}`;
const EMAIL_PREFIX = `m4-test-${RUN_ID}`;
const emailFor = (label: string) => `${EMAIL_PREFIX}-${label}@campushub.test`;

let codeSequence = 1000;
const nextCode = () => `${CODE_PREFIX}-${++codeSequence}`;

let admin: Awaited<ReturnType<typeof createTestUser>>;
let instructorA: Awaited<ReturnType<typeof createTestUser>>;
let instructorB: Awaited<ReturnType<typeof createTestUser>>;
let studentA: Awaited<ReturnType<typeof createTestUser>>;
let studentB: Awaited<ReturnType<typeof createTestUser>>;

let adminCookie: string;
let instructorACookie: string;
let instructorBCookie: string;
let studentACookie: string;
let studentBCookie: string;

let openCourseA: Awaited<ReturnType<typeof createTestCourse>>;
let openCourseB: Awaited<ReturnType<typeof createTestCourse>>;
let closedCourse: Awaited<ReturnType<typeof createTestCourse>>;
let draftCourse: Awaited<ReturnType<typeof createTestCourse>>;

let assignmentA: Awaited<ReturnType<typeof createTestAssignment>>;
let assignmentB: Awaited<ReturnType<typeof createTestAssignment>>;
let assignmentFuture: Awaited<ReturnType<typeof createTestAssignment>>;

let submissionA: Awaited<ReturnType<typeof createTestSubmission>>;

const createCourseFor = (
  instructorId: string,
  overrides: Partial<{ status: CourseStatus; capacity: number }> = {},
) => createTestCourse({ code: nextCode(), instructorId, ...overrides });

const createAssignmentFor = (
  courseId: string,
  overrides: Partial<{ dueAt: Date; maxScore: number }> = {},
) => createTestAssignment({ courseId, ...overrides });

beforeAll(async () => {
  [admin, instructorA, instructorB, studentA, studentB] = await Promise.all([
    createTestUser({ email: emailFor('admin'), role: 'ADMIN', name: 'M4 Admin' }),
    createTestUser({
      email: emailFor('instructor-a'),
      role: 'INSTRUCTOR',
      name: 'M4 Instructor A',
    }),
    createTestUser({
      email: emailFor('instructor-b'),
      role: 'INSTRUCTOR',
      name: 'M4 Instructor B',
    }),
    createTestUser({ email: emailFor('student-a'), role: 'STUDENT', name: 'M4 Student A' }),
    createTestUser({ email: emailFor('student-b'), role: 'STUDENT', name: 'M4 Student B' }),
  ]);

  [adminCookie, instructorACookie, instructorBCookie, studentACookie, studentBCookie] =
    await Promise.all([
      loginAs(admin.email),
      loginAs(instructorA.email),
      loginAs(instructorB.email),
      loginAs(studentA.email),
      loginAs(studentB.email),
    ]);

  [openCourseA, openCourseB, closedCourse, draftCourse] = await Promise.all([
    createCourseFor(instructorA.id, { capacity: 5 }),
    createCourseFor(instructorB.id, { capacity: 5 }),
    createCourseFor(instructorA.id, { status: 'CLOSED' }),
    createCourseFor(instructorA.id, { status: 'DRAFT' }),
  ]);

  // Enroll students in courses
  await prisma.enrollment.createMany({
    data: [
      { studentId: studentA.id, courseId: openCourseA.id, status: 'ENROLLED' },
      { studentId: studentB.id, courseId: openCourseA.id, status: 'ENROLLED' },
      { studentId: studentA.id, courseId: openCourseB.id, status: 'ENROLLED' },
    ],
  });

  [assignmentA, assignmentB, assignmentFuture] = await Promise.all([
    createAssignmentFor(openCourseA.id, {
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxScore: 100,
    }), // due tomorrow
    createAssignmentFor(openCourseA.id, {
      dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      maxScore: 50,
    }), // due yesterday (past)
    createAssignmentFor(openCourseB.id, {
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxScore: 100,
    }), // due next week
  ]);

  // Create a submission for studentA on assignmentA (due tomorrow, so on-time)
  submissionA = await createTestSubmission({
    assignmentId: assignmentA.id,
    studentId: studentA.id,
    content: 'Initial submission',
    submittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
  });

  // Create a late submission for studentB on assignmentB (past due)
  await createTestSubmission({
    assignmentId: assignmentB.id,
    studentId: studentB.id,
    content: 'Late submission',
    submittedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
  });

  // Create a graded submission for studentA on assignmentFuture (due next week)
  await createTestSubmission({
    assignmentId: assignmentFuture.id,
    studentId: studentA.id,
    content: 'Graded submission',
    submittedAt: new Date(),
    score: 85,
    feedback: 'Good work',
    gradedAt: new Date(),
  });
}, 30_000);

afterAll(async () => {
  // Clean up in reverse order of dependencies: submissions -> assignments -> courses -> users
  await prisma.submission.deleteMany({
    where: { assignment: { course: { code: { startsWith: `${CODE_PREFIX}-` } } } },
  });
  await prisma.assignment.deleteMany({
    where: { course: { code: { startsWith: `${CODE_PREFIX}-` } } },
  });
  await prisma.course.deleteMany({ where: { code: { startsWith: `${CODE_PREFIX}-` } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `${EMAIL_PREFIX}-` } } });
  await prisma.$disconnect();
}, 30_000);

describe('Assignment authorization and validation', () => {
  it('requires authentication for assignment list', async () => {
    const response = await request(app).get('/api/v1/assignments');
    expect(response.status).toBe(401);
  });

  it('forbids students from creating assignments', async () => {
    const payload = {
      courseId: openCourseA.id,
      title: 'Test',
      description: 'Desc',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      maxScore: 100,
    };

    const studentResponse = await request(app)
      .post('/api/v1/instructor/assignments')
      .set('Cookie', studentACookie)
      .send(payload);
    expect(studentResponse.status).toBe(403);
  });

  it('validates assignment create input', async () => {
    const missingFields = await request(app)
      .post('/api/v1/instructor/assignments')
      .set('Cookie', instructorACookie)
      .send({ courseId: openCourseA.id });
    expect(missingFields.status).toBe(400);
    expect(missingFields.body.error.code).toBe('VALIDATION_ERROR');

    const pastDue = await request(app)
      .post('/api/v1/instructor/assignments')
      .set('Cookie', instructorACookie)
      .send({
        courseId: openCourseA.id,
        title: 'Test',
        description: 'Desc',
        dueAt: new Date(Date.now() - 86400000).toISOString(),
        maxScore: 100,
      });
    expect(pastDue.status).toBe(400);
    expect(pastDue.body.error.code).toBe('VALIDATION_ERROR');

    const zeroScore = await request(app)
      .post('/api/v1/instructor/assignments')
      .set('Cookie', instructorACookie)
      .send({
        courseId: openCourseA.id,
        title: 'Test',
        description: 'Desc',
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        maxScore: 0,
      });
    expect(zeroScore.status).toBe(400);

    const invalidCourse = await request(app)
      .post('/api/v1/instructor/assignments')
      .set('Cookie', instructorACookie)
      .send({
        courseId: randomUUID(),
        title: 'Test',
        description: 'Desc',
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        maxScore: 100,
      });
    expect(invalidCourse.status).toBe(404);
    expect(invalidCourse.body.error.code).toBe('COURSE_NOT_FOUND');

    const draftCourseAssignment = await request(app)
      .post('/api/v1/instructor/assignments')
      .set('Cookie', instructorACookie)
      .send({
        courseId: draftCourse.id,
        title: 'Test',
        description: 'Desc',
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        maxScore: 100,
      });
    expect(draftCourseAssignment.status).toBe(404); // Course not found because DRAFT
  });

  it('creates an assignment as instructor', async () => {
    const payload = {
      courseId: openCourseA.id,
      title: 'New Assignment',
      description: 'New Desc',
      dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      maxScore: 75,
    };
    const response = await request(app)
      .post('/api/v1/instructor/assignments')
      .set('Cookie', instructorACookie)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.data.assignment.title).toBe('New Assignment');
    expect(response.body.data.assignment.maxScore).toBe(75);
    expect(response.body.data.assignment.courseId).toBe(openCourseA.id);
    expect(response.body.data.assignment).not.toHaveProperty('passwordHash');
  });

  it('creates an assignment as admin for any course', async () => {
    const payload = {
      courseId: openCourseB.id,
      title: 'Admin Assignment',
      description: 'Admin Desc',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      maxScore: 100,
    };
    const response = await request(app)
      .post('/api/v1/admin/assignments')
      .set('Cookie', adminCookie)
      .send(payload);
    expect(response.status).toBe(201);
    expect(response.body.data.assignment.courseId).toBe(openCourseB.id);
  });

  it('forbids instructors from creating assignments for other instructors courses', async () => {
    const payload = {
      courseId: openCourseB.id,
      title: 'Forbidden',
      description: 'Desc',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      maxScore: 100,
    };
    const response = await request(app)
      .post('/api/v1/instructor/assignments')
      .set('Cookie', instructorACookie)
      .send(payload);
    expect(response.status).toBe(403);
  });

  it('validates assignment update input', async () => {
    // Create a fresh assignment to update
    const assignment = await createAssignmentFor(openCourseA.id);

    const empty = await request(app)
      .patch(`/api/v1/instructor/assignments/${assignment.id}`)
      .set('Cookie', instructorACookie)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const pastDue = await request(app)
      .patch(`/api/v1/instructor/assignments/${assignment.id}`)
      .set('Cookie', instructorACookie)
      .send({ dueAt: new Date(Date.now() - 86400000).toISOString() });
    expect(pastDue.status).toBe(400);

    const zeroScore = await request(app)
      .patch(`/api/v1/instructor/assignments/${assignment.id}`)
      .set('Cookie', instructorACookie)
      .send({ maxScore: 0 });
    expect(zeroScore.status).toBe(400);
  });
});

describe('Assignment ownership and visibility', () => {
  it('instructors can list their own assignments', async () => {
    const response = await request(app)
      .get('/api/v1/assignments')
      .query({ courseId: openCourseA.id })
      .set('Cookie', instructorACookie);
    expect(response.status).toBe(200);
    const ids = response.body.data.assignments.map((a: { id: string }) => a.id);
    expect(ids).toContain(assignmentA.id);
    expect(ids).toContain(assignmentB.id);
  });

  it('students can list assignments for enrolled courses', async () => {
    const response = await request(app)
      .get('/api/v1/assignments')
      .query({ courseId: openCourseA.id })
      .set('Cookie', studentACookie);
    expect(response.status).toBe(200);
    const ids = response.body.data.assignments.map((a: { id: string }) => a.id);
    expect(ids).toContain(assignmentA.id);
    expect(ids).toContain(assignmentB.id);
  });

  it('forbids students from listing assignments for unenrolled courses', async () => {
    const response = await request(app)
      .get('/api/v1/assignments')
      .query({ courseId: openCourseB.id })
      .set('Cookie', studentBCookie);
    expect(response.status).toBe(403);
  });

  it('forbids students from listing without courseId', async () => {
    const response = await request(app).get('/api/v1/assignments').set('Cookie', studentACookie);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_FILTER');
  });

  it('admins can list all assignments', async () => {
    const response = await request(app)
      .get('/api/v1/assignments')
      .query({ courseId: openCourseB.id })
      .set('Cookie', adminCookie);
    expect(response.status).toBe(200);
    const ids = response.body.data.assignments.map((a: { id: string }) => a.id);
    expect(ids).toContain(assignmentFuture.id);
  });

  it('enforces detail visibility', async () => {
    // Student enrolled can see
    const studentDetail = await request(app)
      .get(`/api/v1/assignments/${assignmentA.id}`)
      .set('Cookie', studentACookie);
    expect(studentDetail.status).toBe(200);

    // Student not enrolled cannot see
    const notEnrolled = await request(app)
      .get(`/api/v1/assignments/${assignmentFuture.id}`)
      .set('Cookie', studentBCookie);
    expect(notEnrolled.status).toBe(404);

    // Instructor owns can see
    const instructorDetail = await request(app)
      .get(`/api/v1/assignments/${assignmentA.id}`)
      .set('Cookie', instructorACookie);
    expect(instructorDetail.status).toBe(200);

    // Instructor not owner cannot see
    const notOwner = await request(app)
      .get(`/api/v1/assignments/${assignmentFuture.id}`)
      .set('Cookie', instructorACookie);
    expect(notOwner.status).toBe(404);

    // Admin can see all
    const adminDetail = await request(app)
      .get(`/api/v1/assignments/${assignmentFuture.id}`)
      .set('Cookie', adminCookie);
    expect(adminDetail.status).toBe(200);
  });

  it('never exposes sensitive fields', async () => {
    const detail = await request(app)
      .get(`/api/v1/assignments/${assignmentA.id}`)
      .set('Cookie', adminCookie);
    expect(JSON.stringify(detail.body)).not.toContain('passwordHash');
  });
});

describe('Assignment updates and graded submission protection', () => {
  it('allows full updates on ungraded assignments', async () => {
    const assignment = await createAssignmentFor(openCourseA.id);
    const response = await request(app)
      .patch(`/api/v1/instructor/assignments/${assignment.id}`)
      .set('Cookie', instructorACookie)
      .send({
        title: 'Updated',
        maxScore: 200,
        dueAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      });
    expect(response.status).toBe(200);
    expect(response.body.data.assignment.title).toBe('Updated');
    expect(response.body.data.assignment.maxScore).toBe(200);
  });

  it('restricts updates on assignments with graded submissions', async () => {
    // assignmentFuture has a graded submission for studentA
    const response = await request(app)
      .patch(`/api/v1/instructor/assignments/${assignmentFuture.id}`)
      .set('Cookie', instructorBCookie)
      .send({ maxScore: 50 });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.message).toContain('graded submissions');

    // Title/description still allowed
    const allowed = await request(app)
      .patch(`/api/v1/instructor/assignments/${assignmentFuture.id}`)
      .set('Cookie', instructorBCookie)
      .send({ title: 'New Title', description: 'New Desc' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.assignment.title).toBe('New Title');
  });

  it('forbids instructors from updating other instructors assignments', async () => {
    const response = await request(app)
      .patch(`/api/v1/instructor/assignments/${assignmentA.id}`)
      .set('Cookie', instructorBCookie)
      .send({ title: 'Forbidden' });
    expect(response.status).toBe(403);
  });

  it('admins can update any assignment even with graded submissions', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/assignments/${assignmentFuture.id}`)
      .set('Cookie', adminCookie)
      .send({ maxScore: 50 });
    expect(response.status).toBe(200);
    expect(response.body.data.assignment.maxScore).toBe(50);
  });
});

describe('Assignment deletion', () => {
  it('instructor can delete own assignment', async () => {
    const assignment = await createAssignmentFor(openCourseA.id);
    const response = await request(app)
      .delete(`/api/v1/instructor/assignments/${assignment.id}`)
      .set('Cookie', instructorACookie);
    expect(response.status).toBe(204);

    const missing = await request(app)
      .get(`/api/v1/assignments/${assignment.id}`)
      .set('Cookie', instructorACookie);
    expect(missing.status).toBe(404);
  });

  it('instructor cannot delete other instructor assignment', async () => {
    const response = await request(app)
      .delete(`/api/v1/instructor/assignments/${assignmentFuture.id}`)
      .set('Cookie', instructorACookie);
    expect(response.status).toBe(403);
  });

  it('admin can delete any assignment', async () => {
    const assignment = await createAssignmentFor(openCourseB.id);
    const response = await request(app)
      .delete(`/api/v1/admin/assignments/${assignment.id}`)
      .set('Cookie', adminCookie);
    expect(response.status).toBe(204);
  });

  it('cascades deletion to submissions', async () => {
    const assignment = await createAssignmentFor(openCourseA.id);
    await createTestSubmission({
      assignmentId: assignment.id,
      studentId: studentA.id,
      content: 'To be deleted',
    });

    await request(app)
      .delete(`/api/v1/instructor/assignments/${assignment.id}`)
      .set('Cookie', instructorACookie);

    const subs = await prisma.submission.findMany({ where: { assignmentId: assignment.id } });
    expect(subs).toHaveLength(0);
  });
});

describe('Submission authorization and validation', () => {
  it('requires authentication for submit', async () => {
    const response = await request(app)
      .post(`/api/v1/assignments/${assignmentA.id}/submit`)
      .send({ content: 'Test' });
    expect(response.status).toBe(401);
  });

  it('forbids non-students from submitting', async () => {
    const instructorRes = await request(app)
      .post(`/api/v1/assignments/${assignmentA.id}/submit`)
      .set('Cookie', instructorACookie)
      .send({ content: 'Test' });
    expect(instructorRes.status).toBe(403);

    const adminRes = await request(app)
      .post(`/api/v1/assignments/${assignmentA.id}/submit`)
      .set('Cookie', adminCookie)
      .send({ content: 'Test' });
    expect(adminRes.status).toBe(403);
  });

  it('validates submit input', async () => {
    const empty = await request(app)
      .post(`/api/v1/assignments/${assignmentA.id}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: '' });
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const tooLong = await request(app)
      .post(`/api/v1/assignments/${assignmentA.id}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: 'x'.repeat(10001) });
    expect(tooLong.status).toBe(400);
  });

  it('validates grade input', async () => {
    const invalid = await request(app)
      .patch(`/api/v1/instructor/submissions/${submissionA.id}/grade`)
      .set('Cookie', instructorACookie)
      .send({ grade: -1 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const tooHigh = await request(app)
      .patch(`/api/v1/instructor/submissions/${submissionA.id}/grade`)
      .set('Cookie', instructorACookie)
      .send({ grade: 101 }); // maxScore is 100
    expect(tooHigh.status).toBe(400);
    expect(tooHigh.body.error.code).toBe('INVALID_GRADE');
  });
});

describe('Submission rules and deadlines', () => {
  it('student can submit on-time', async () => {
    // studentB has not submitted to assignmentA (due tomorrow)
    const response = await request(app)
      .post(`/api/v1/assignments/${assignmentA.id}/submit`)
      .set('Cookie', studentBCookie)
      .send({ content: 'Student B on-time submission' });
    expect(response.status).toBe(201);
    expect(response.body.data.submission.studentId).toBe(studentB.id);
    expect(response.body.data.submission.isLate).toBe(false);
  });

  it('student can resubmit before deadline', async () => {
    // studentA already submitted to assignmentA (due tomorrow)
    const first = await request(app)
      .post(`/api/v1/assignments/${assignmentA.id}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: 'First submission' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/v1/assignments/${assignmentA.id}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: 'Resubmission before deadline' });
    expect(second.status).toBe(201);
    expect(second.body.data.submission.content).toBe('Resubmission before deadline');
    expect(second.body.data.submission.submittedAt).not.toEqual(
      first.body.data.submission.submittedAt,
    );
  });

  it('student cannot resubmit after deadline', async () => {
    // assignmentB is past due (yesterday), studentB has late submission already
    const response = await request(app)
      .post(`/api/v1/assignments/${assignmentB.id}/submit`)
      .set('Cookie', studentBCookie)
      .send({ content: 'Attempt resubmit after deadline' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('RESUBMISSION_NOT_ALLOWED_AFTER_DUE_DATE');
  });

  it('student cannot submit if already graded', async () => {
    // assignmentFuture has graded submission for studentA
    const response = await request(app)
      .post(`/api/v1/assignments/${assignmentFuture.id}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: 'Attempt after graded' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SUBMISSION_ALREADY_GRADED');
  });

  it('student can submit late if no prior submission', async () => {
    // Create a fresh assignment past due
    const pastDue = await createAssignmentFor(openCourseA.id, {
      dueAt: new Date(Date.now() - 86400000),
    });
    // studentA has not submitted to this one
    const response = await request(app)
      .post(`/api/v1/assignments/${pastDue.id}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: 'Late initial submission' });
    expect(response.status).toBe(201);
    expect(response.body.data.submission.isLate).toBe(true);
  });

  it('forbids submission to closed/draft courses', async () => {
    const closedAssignment = await createAssignmentFor(closedCourse.id);
    const closedRes = await request(app)
      .post(`/api/v1/assignments/${closedAssignment.id}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: 'Test' });
    expect(closedRes.status).toBe(409);
    expect(closedRes.body.error.code).toBe('COURSE_NOT_OPEN');

    const draftAssignment = await createAssignmentFor(draftCourse.id);
    const draftRes = await request(app)
      .post(`/api/v1/assignments/${draftAssignment.id}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: 'Test' });
    expect(draftRes.status).toBe(409);
  });

  it('validates assignment exists', async () => {
    const missing = await request(app)
      .post(`/api/v1/assignments/${randomUUID()}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: 'Test' });
    expect(missing.status).toBe(404);
  });
});

describe('Submission viewing and listing', () => {
  it('student can view own submission', async () => {
    const response = await request(app)
      .get(`/api/v1/assignments/${assignmentA.id}/my-submission`)
      .set('Cookie', studentACookie);
    expect(response.status).toBe(200);
    expect(response.body.data.submission.studentId).toBe(studentA.id);
    expect(response.body.data.submission.content).toBe('Resubmission before deadline');
  });

  it('student cannot view other student submission', async () => {
    const freshAssignment = await createAssignmentFor(openCourseA.id);
    await createTestSubmission({
      assignmentId: freshAssignment.id,
      studentId: studentA.id,
      content: 'Student A private submission',
    });
    const response = await request(app)
      .get(`/api/v1/assignments/${freshAssignment.id}/my-submission`)
      .set('Cookie', studentBCookie);
    // studentB has not submitted yet, so 404
    expect(response.status).toBe(404);
  });

  it('student lists own submissions', async () => {
    const response = await request(app)
      .get('/api/v1/student/submissions')
      .set('Cookie', studentACookie);
    expect(response.status).toBe(200);
    const ids = response.body.data.submissions.map((s: { id: string }) => s.id);
    expect(ids).toContain(submissionA.id);
    expect(ids).toContain(
      response.body.data.submissions.find(
        (s: { assignmentId: string }) => s.assignmentId === assignmentFuture.id,
      ).id,
    ); // The graded one
  });

  it('instructor views submissions for own assignment', async () => {
    const response = await request(app)
      .get(`/api/v1/instructor/assignments/${assignmentA.id}/submissions`)
      .set('Cookie', instructorACookie);
    expect(response.status).toBe(200);
    expect(response.body.data.submissions.length).toBeGreaterThanOrEqual(1); // At least studentA's
    expect(response.body.data.submissions[0]).toHaveProperty('student');
  });

  it('instructor cannot view submissions for other instructor assignment', async () => {
    const response = await request(app)
      .get(`/api/v1/instructor/assignments/${assignmentFuture.id}/submissions`)
      .set('Cookie', instructorACookie);
    expect(response.status).toBe(403);
  });

  it('admin views all submissions for any assignment', async () => {
    const response = await request(app)
      .get(`/api/v1/admin/assignments/${assignmentFuture.id}/submissions`)
      .set('Cookie', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.data.submissions.length).toBeGreaterThanOrEqual(1);
  });

  it('filters and paginates submissions', async () => {
    const response = await request(app)
      .get(`/api/v1/instructor/assignments/${assignmentA.id}/submissions`)
      .query({ page: 1, limit: 1 })
      .set('Cookie', instructorACookie);
    expect(response.status).toBe(200);
    expect(response.body.data.submissions.length).toBeLessThanOrEqual(1);
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.limit).toBe(1);
  });

  it('filters by graded status', async () => {
    // assignmentA has ungraded submissions (studentA, maybe studentB)
    const ungraded = await request(app)
      .get(`/api/v1/instructor/assignments/${assignmentA.id}/submissions`)
      .query({ isGraded: 'false' })
      .set('Cookie', instructorACookie);
    expect(ungraded.status).toBe(200);
    ungraded.body.data.submissions.forEach((s: { gradedAt: Date | null }) =>
      expect(s.gradedAt).toBeNull(),
    );

    // assignmentFuture has graded submission
    const graded = await request(app)
      .get(`/api/v1/instructor/assignments/${assignmentFuture.id}/submissions`)
      .query({ isGraded: 'true' })
      .set('Cookie', instructorBCookie);
    expect(graded.status).toBe(200);
    graded.body.data.submissions.forEach((s: { gradedAt: Date | null }) =>
      expect(s.gradedAt).not.toBeNull(),
    );
  });

  it('searches by student name/email', async () => {
    const response = await request(app)
      .get(`/api/v1/instructor/assignments/${assignmentA.id}/submissions`)
      .query({ search: studentA.email })
      .set('Cookie', instructorACookie);
    expect(response.status).toBe(200);
    expect(response.body.data.submissions.length).toBe(1);
    expect(response.body.data.submissions[0].student.email).toBe(studentA.email);
  });
});

describe('Grading and feedback', () => {
  it('instructor can grade own course submission', async () => {
    const response = await request(app)
      .patch(`/api/v1/instructor/submissions/${submissionA.id}/grade`)
      .set('Cookie', instructorACookie)
      .send({ grade: 90, feedback: 'Excellent' });
    expect(response.status).toBe(200);
    expect(response.body.data.submission.grade).toBe(90);
    expect(response.body.data.submission.feedback).toBe('Excellent');
    expect(response.body.data.submission.gradedAt).not.toBeNull();
  });

  it('instructor cannot grade other instructor submission', async () => {
    // Find a submission for assignmentFuture (instructorB's course)
    const subs = await prisma.submission.findFirst({
      where: { assignmentId: assignmentFuture.id, gradedAt: null },
    });
    if (!subs) {
      // Create one for testing if none ungraded
      await createTestSubmission({
        assignmentId: assignmentFuture.id,
        studentId: studentB.id,
        content: 'For instructorA test',
      });
      const sub = await prisma.submission.findFirst({
        where: { assignmentId: assignmentFuture.id, studentId: studentB.id, gradedAt: null },
      });
      if (sub) {
        const response = await request(app)
          .patch(`/api/v1/instructor/submissions/${sub.id}/grade`)
          .set('Cookie', instructorACookie)
          .send({ grade: 50 });
        expect(response.status).toBe(403);
      }
    } else {
      const response = await request(app)
        .patch(`/api/v1/instructor/submissions/${subs.id}/grade`)
        .set('Cookie', instructorACookie)
        .send({ grade: 50 });
      expect(response.status).toBe(403);
    }
  });

  it('admin can grade any submission', async () => {
    const subs = await prisma.submission.findFirst({
      where: { assignmentId: assignmentFuture.id, gradedAt: null },
    });
    if (subs) {
      const response = await request(app)
        .patch(`/api/v1/admin/submissions/${subs.id}/grade`)
        .set('Cookie', adminCookie)
        .send({ grade: 40 });
      expect(response.status).toBe(200);
    }
  });

  it('validates grade boundaries', async () => {
    const ungradedSub = await prisma.submission.findFirst({
      where: { assignmentId: assignmentA.id, gradedAt: null, studentId: { not: studentA.id } },
    });
    if (!ungradedSub) {
      // create one for studentB if needed
      await createTestSubmission({
        assignmentId: assignmentA.id,
        studentId: studentB.id,
        content: 'For grading test',
      });
    }
    const sub = await prisma.submission.findFirst({
      where: { assignmentId: assignmentA.id, gradedAt: null, studentId: studentB.id },
    });

    if (sub) {
      const tooHigh = await request(app)
        .patch(`/api/v1/instructor/submissions/${sub.id}/grade`)
        .set('Cookie', instructorACookie)
        .send({ grade: 101 }); // maxScore 100
      expect(tooHigh.status).toBe(400);
      expect(tooHigh.body.error.code).toBe('INVALID_GRADE');

      const negative = await request(app)
        .patch(`/api/v1/instructor/submissions/${sub.id}/grade`)
        .set('Cookie', instructorACookie)
        .send({ grade: -5 });
      expect(negative.status).toBe(400);
    }
  });

  it('updates gradedAt on grade', async () => {
    const freshAssignment = await createAssignmentFor(openCourseA.id);
    const sub = await createTestSubmission({
      assignmentId: freshAssignment.id,
      studentId: studentB.id,
      content: 'Fresh for grade test',
    });
    const before = await prisma.submission.findUnique({ where: { id: sub.id } });
    expect(before?.gradedAt).toBeNull();

    await request(app)
      .patch(`/api/v1/instructor/submissions/${sub.id}/grade`)
      .set('Cookie', instructorACookie)
      .send({ grade: 75 });

    const after = await prisma.submission.findUnique({ where: { id: sub.id } });
    expect(after?.gradedAt).not.toBeNull();
  });

  it('forbids students from grading', async () => {
    const response = await request(app)
      .patch(`/api/v1/instructor/submissions/${submissionA.id}/grade`)
      .set('Cookie', studentACookie)
      .send({ grade: 100 });
    expect(response.status).toBe(403);
  });
});

describe('Concurrency and edge cases', () => {
  it('handles concurrent submissions gracefully', async () => {
    const newAssignment = await createAssignmentFor(openCourseA.id, {
      dueAt: new Date(Date.now() + 86400000),
    });
    // Two students submit simultaneously
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/v1/assignments/${newAssignment.id}/submit`)
        .set('Cookie', studentACookie)
        .send({ content: 'A' }),
      request(app)
        .post(`/api/v1/assignments/${newAssignment.id}/submit`)
        .set('Cookie', studentBCookie)
        .send({ content: 'B' }),
    ]);
    expect([res1.status, res2.status].sort()).toEqual([201, 201]); // Both should succeed (different students)
  });

  it('prevents duplicate submissions via unique constraint', async () => {
    // Unique constraint on (studentId, assignmentId) is enforced by DB
    // But our logic handles it via findUnique then create/update
    // Test by submitting for same student twice (should update)
    const assignment = await createAssignmentFor(openCourseA.id);
    await request(app)
      .post(`/api/v1/assignments/${assignment.id}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: 'First' });
    const res = await request(app)
      .post(`/api/v1/assignments/${assignment.id}/submit`)
      .set('Cookie', studentACookie)
      .send({ content: 'Second' });
    expect(res.status).toBe(201);
    expect(res.body.data.submission.content).toBe('Second');
  });
});
