import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';
import { AppError } from '../../errors/app-error.js';
import { prisma } from '../../lib/prisma.js';
import { lockAssignmentRow } from '../../lib/row-lock.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  assignmentInclude,
  toAssignmentSummary,
  type AssignmentWithRelations,
} from '../assignments/assignment.service.js';
import type { PaginationMeta } from '../courses/course.types.js';
import type {
  SubmissionDetail,
  SubmissionListResult,
  SubmissionSummary,
} from './submission.types.js';
import type {
  GradeSubmissionInput,
  SubmissionListQuery,
  SubmitSubmissionInput,
} from './submission.schemas.js';

const SUBMISSION_NOT_FOUND_MESSAGE = 'Submission not found.';
const ASSIGNMENT_NOT_FOUND_MESSAGE = 'Assignment not found.';

const buildMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const submissionInclude = {
  assignment: {
    include: assignmentInclude,
  },
  student: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.SubmissionInclude;

export type SubmissionWithRelations = Prisma.SubmissionGetPayload<{
  include: typeof submissionInclude;
}>;

export const toSubmissionSummary = (submission: SubmissionWithRelations): SubmissionSummary => ({
  id: submission.id,
  assignmentId: submission.assignmentId,
  studentId: submission.studentId,
  submittedAt: submission.submittedAt,
  gradedAt: submission.gradedAt,
  grade: submission.score,
  isLate: submission.submittedAt > submission.assignment.dueAt,
  feedback: submission.feedback,
});

export const toSubmissionDetail = (submission: SubmissionWithRelations): SubmissionDetail => ({
  ...toSubmissionSummary(submission),
  content: submission.content,
  assignment: toAssignmentSummary(submission.assignment),
  student: submission.student,
});

const ensureStudentEnrollmentAndAssignmentVisibility = async (
  db: Prisma.TransactionClient | PrismaClient,
  studentId: string,
  assignmentId: string,
): Promise<AssignmentWithRelations> => {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: assignmentInclude,
  });

  if (!assignment) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', ASSIGNMENT_NOT_FOUND_MESSAGE);
  }

  if (assignment.course.status !== 'OPEN') {
    throw new AppError(
      409,
      'COURSE_NOT_OPEN',
      'Cannot submit to assignments in a non-open course.',
    );
  }

  const enrollment = await db.enrollment.findUnique({
    where: {
      studentId_courseId: { studentId, courseId: assignment.courseId },
    },
    select: { status: true },
  });

  if (!enrollment || enrollment.status !== 'ENROLLED') {
    throw new AppError(403, 'FORBIDDEN', 'You are not enrolled in this course.');
  }

  return assignment;
};

const ensureSubmissionGradingPermission = async (
  db: Prisma.TransactionClient | PrismaClient,
  user: AuthUser,
  submissionId: string,
): Promise<SubmissionWithRelations> => {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: submissionInclude,
  });

  if (!submission) {
    throw new AppError(404, 'SUBMISSION_NOT_FOUND', SUBMISSION_NOT_FOUND_MESSAGE);
  }

  if (user.role === 'INSTRUCTOR' && submission.assignment.course.instructorId !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only grade submissions for your own courses.');
  }

  if (user.role === 'STUDENT') {
    throw new AppError(403, 'FORBIDDEN', 'Students cannot grade submissions.');
  }

  return submission;
};

const buildSubmissionWhere = (
  user: AuthUser,
  query: SubmissionListQuery,
): Prisma.SubmissionWhereInput => {
  const filters: Prisma.SubmissionWhereInput[] = [];

  if (user.role === 'STUDENT') {
    filters.push({ studentId: user.id });
    // Students can optionally filter by assignmentId to see their submissions for a specific assignment
    if (query.assignmentId) {
      filters.push({ assignmentId: query.assignmentId });
    } else {
      // If no assignmentId, students only see submissions for courses they are ENROLLED in
      filters.push({
        assignment: {
          course: {
            enrollments: {
              some: { studentId: user.id, status: 'ENROLLED' },
            },
          },
        },
      });
    }
  } else if (user.role === 'INSTRUCTOR') {
    if (!query.assignmentId) {
      throw new AppError(
        400,
        'INVALID_FILTER',
        'Instructors must provide an assignmentId to list submissions.',
      );
    }
    // Instructors see submissions for a specific assignment in their own courses
    filters.push({
      assignmentId: query.assignmentId,
      assignment: { course: { instructorId: user.id } },
    });

    if (query.search) {
      filters.push({
        student: {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      });
    }
  } else if (user.role === 'ADMIN') {
    // Admins see all submissions, potentially filtered by assignmentId or search
    if (query.assignmentId) {
      filters.push({ assignmentId: query.assignmentId });
    }
    if (query.search) {
      filters.push({
        student: {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      });
    }
  }

  if (query.isGraded !== undefined) {
    filters.push({ gradedAt: query.isGraded ? { not: null } : null });
  }

  return filters.length > 0 ? { AND: filters } : {};
};

export const submitSubmission = async (
  studentId: string,
  assignmentId: string,
  input: SubmitSubmissionInput,
): Promise<SubmissionDetail> => {
  return prisma.$transaction(async (tx) => {
    // Lock the assignment row to prevent concurrent submissions for the same student
    await lockAssignmentRow(tx, assignmentId);

    const assignment = await ensureStudentEnrollmentAndAssignmentVisibility(
      tx,
      studentId,
      assignmentId,
    );

    const existingSubmission = await tx.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      select: { id: true, gradedAt: true },
    });

    if (existingSubmission?.gradedAt) {
      throw new AppError(
        409,
        'SUBMISSION_ALREADY_GRADED',
        'This submission has already been graded and cannot be updated.',
      );
    }

    const currentTime = new Date();
    const isLate = currentTime > assignment.dueAt;

    if (isLate && existingSubmission) {
      // If it's late and there's an existing submission (meaning it's a resubmission attempt),
      // then resubmissions are not allowed after the due date.
      throw new AppError(
        409,
        'RESUBMISSION_NOT_ALLOWED_AFTER_DUE_DATE',
        'Resubmissions are not allowed after the due date.',
      );
    }

    const data = {
      content: input.content,
      submittedAt: currentTime,
    };

    const submission = existingSubmission
      ? await tx.submission.update({
          where: { id: existingSubmission.id },
          data,
          include: submissionInclude,
        })
      : await tx.submission.create({
          data: {
            ...data,
            studentId,
            assignmentId,
          },
          include: submissionInclude,
        });

    return toSubmissionDetail(submission);
  });
};

export const getOwnSubmission = async (
  studentId: string,
  assignmentId: string,
): Promise<SubmissionDetail> => {
  const submission = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    include: submissionInclude,
  });

  if (!submission) {
    throw new AppError(404, 'SUBMISSION_NOT_FOUND', SUBMISSION_NOT_FOUND_MESSAGE);
  }

  // Ensure the assignment is visible to the student (i.e., they are enrolled)
  await ensureStudentEnrollmentAndAssignmentVisibility(prisma, studentId, assignmentId);

  return toSubmissionDetail(submission);
};

export const listSubmissions = async (
  user: AuthUser,
  query: SubmissionListQuery,
): Promise<SubmissionListResult> => {
  // For instructors, verify they own the assignment before listing submissions
  if (user.role === 'INSTRUCTOR' && query.assignmentId) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: query.assignmentId },
      select: { course: { select: { instructorId: true } } },
    });
    if (!assignment || assignment.course.instructorId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only view submissions for your own courses.');
    }
  }

  const where = buildSubmissionWhere(user, query);
  const skip = (query.page - 1) * query.limit;

  const [total, submissions] = await prisma.$transaction([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      include: submissionInclude,
      orderBy: [{ assignment: { dueAt: 'asc' } }, { student: { name: 'asc' } }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    submissions: submissions.map(toSubmissionDetail),
    meta: buildMeta(query.page, query.limit, total),
  };
};

export const gradeSubmission = async (
  user: AuthUser,
  submissionId: string,
  input: GradeSubmissionInput,
): Promise<SubmissionDetail> => {
  return prisma.$transaction(async (tx) => {
    const submission = await ensureSubmissionGradingPermission(tx, user, submissionId);

    if (input.grade < 0 || input.grade > submission.assignment.maxScore) {
      throw new AppError(
        400,
        'INVALID_GRADE',
        `Grade must be between 0 and ${submission.assignment.maxScore}.`,
      );
    }

    const updatedSubmission = await tx.submission.update({
      where: { id: submissionId },
      data: {
        score: input.grade,
        feedback: input.feedback,
        gradedAt: new Date(),
      },
      include: submissionInclude,
    });

    return toSubmissionDetail(updatedSubmission);
  });
};
