import type { CourseStatus } from '../../generated/prisma/enums.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';
import { AppError } from '../../errors/app-error.js';
import { prisma } from '../../lib/prisma.js';
import { lockCourseRow } from '../../lib/row-lock.js';
import type { AuthUser } from '../auth/auth.types.js';
import { courseInclude, toCourseSummary } from '../courses/course.mapper.js';
import type { PaginationMeta } from '../courses/course.types.js';
import type {
  AssignmentDetail,
  AssignmentListResult,
  AssignmentSummary,
} from './assignment.types.js';
import type {
  AssignmentListQuery,
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from './assignment.schemas.js';

const ASSIGNMENT_NOT_FOUND_MESSAGE = 'Assignment not found.';
const COURSE_NOT_FOUND_MESSAGE = 'Course not found.';

const buildMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const assignmentInclude = {
  course: {
    include: courseInclude,
  },
  _count: {
    select: {
      submissions: {
        where: { gradedAt: { not: null } },
      },
    },
  },
} satisfies Prisma.AssignmentInclude;

export type AssignmentWithRelations = Prisma.AssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;

export const toAssignmentSummary = (assignment: AssignmentWithRelations): AssignmentSummary => ({
  id: assignment.id,
  courseId: assignment.courseId,
  title: assignment.title,
  dueAt: assignment.dueAt,
  maxScore: assignment.maxScore,
  createdAt: assignment.createdAt,
  updatedAt: assignment.updatedAt,
  hasGradedSubmissions: assignment._count.submissions > 0,
});

export const toAssignmentDetail = (assignment: AssignmentWithRelations): AssignmentDetail => ({
  ...toAssignmentSummary(assignment),
  description: assignment.description,
  course: toCourseSummary(assignment.course),
});

const ensureCourseStatus = async (
  db: Prisma.TransactionClient | PrismaClient,
  courseId: string,
  requiredStatus: CourseStatus[],
): Promise<void> => {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { status: true },
  });

  if (!course || !requiredStatus.includes(course.status)) {
    throw new AppError(404, 'COURSE_NOT_FOUND', COURSE_NOT_FOUND_MESSAGE);
  }
};

const buildAssignmentWhere = (
  user: AuthUser,
  query: AssignmentListQuery,
): Prisma.AssignmentWhereInput => {
  const filters: Prisma.AssignmentWhereInput[] = [];

  if (query.courseId) {
    filters.push({ courseId: query.courseId });
  }

  if (user.role === 'STUDENT') {
    // Students can only see assignments for courses they are ENROLLED in
    if (!query.courseId) {
      throw new AppError(
        400,
        'INVALID_FILTER',
        'Students must provide a courseId to list assignments.',
      );
    }
    filters.push({
      course: {
        enrollments: {
          some: { studentId: user.id, status: 'ENROLLED' },
        },
      },
    });
  } else if (user.role === 'INSTRUCTOR') {
    // Instructors see assignments for their own courses
    filters.push({ course: { instructorId: user.id } });
  }

  // For ADMIN, no specific role-based filter is added, they see all based on initial query

  return filters.length > 0 ? { AND: filters } : {};
};

export const listAssignments = async (
  user: AuthUser,
  query: AssignmentListQuery,
): Promise<AssignmentListResult> => {
  if (user.role === 'STUDENT') {
    if (!query.courseId) {
      throw new AppError(
        400,
        'INVALID_FILTER',
        'Students must provide a courseId to list assignments.',
      );
    }
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: user.id,
          courseId: query.courseId,
        },
      },
      select: { status: true },
    });
    if (!enrollment || enrollment.status !== 'ENROLLED') {
      throw new AppError(403, 'FORBIDDEN', 'You are not enrolled in this course.');
    }
  }

  const where = buildAssignmentWhere(user, query);
  const skip = (query.page - 1) * query.limit;

  const [total, assignments] = await prisma.$transaction([
    prisma.assignment.count({ where }),
    prisma.assignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: [{ course: { code: 'asc' } }, { dueAt: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    assignments: assignments.map(toAssignmentSummary),
    meta: buildMeta(query.page, query.limit, total),
  };
};

export const getAssignmentDetail = async (
  user: AuthUser,
  assignmentId: string,
): Promise<AssignmentDetail> => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: assignmentInclude,
  });

  if (!assignment) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', ASSIGNMENT_NOT_FOUND_MESSAGE);
  }

  let isStudentEnrolled = false;
  if (user.role === 'STUDENT') {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: user.id,
          courseId: assignment.courseId,
        },
      },
      select: { status: true },
    });
    isStudentEnrolled = enrollment?.status === 'ENROLLED';
  }

  const isVisible =
    user.role === 'ADMIN' ||
    (user.role === 'INSTRUCTOR' && assignment.course.instructorId === user.id) ||
    (user.role === 'STUDENT' && isStudentEnrolled);

  if (!isVisible) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', ASSIGNMENT_NOT_FOUND_MESSAGE);
  }

  return toAssignmentDetail(assignment);
};

export const createAssignment = async (
  user: AuthUser,
  input: CreateAssignmentInput,
): Promise<AssignmentDetail> => {
  if (user.role === 'STUDENT') {
    throw new AppError(403, 'FORBIDDEN', 'Students cannot create assignments.');
  }

  return prisma.$transaction(async (tx) => {
    await lockCourseRow(tx, input.courseId);
    await ensureCourseStatus(tx, input.courseId, ['OPEN']);

    if (user.role === 'INSTRUCTOR') {
      const course = await tx.course.findUnique({
        where: { id: input.courseId },
        select: { instructorId: true },
      });
      if (!course || course.instructorId !== user.id) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'You can only create assignments for your own courses.',
        );
      }
    }

    const assignment = await tx.assignment.create({
      data: {
        title: input.title,
        description: input.description,
        dueAt: input.dueAt,
        maxScore: input.maxScore,
        course: { connect: { id: input.courseId } },
      },
      include: assignmentInclude,
    });

    return toAssignmentDetail(assignment);
  });
};

export const updateAssignment = async (
  user: AuthUser,
  assignmentId: string,
  input: UpdateAssignmentInput,
): Promise<AssignmentDetail> => {
  if (user.role === 'STUDENT') {
    throw new AppError(403, 'FORBIDDEN', 'Students cannot update assignments.');
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.assignment.findUnique({
      where: { id: assignmentId },
      include: assignmentInclude,
    });

    if (!existing) {
      throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', ASSIGNMENT_NOT_FOUND_MESSAGE);
    }

    // Ensure instructor owns the course
    if (user.role === 'INSTRUCTOR') {
      if (existing.course.instructorId !== user.id) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'You can only update assignments for your own courses.',
        );
      }
    }

    // Business rule: If assignment has graded submissions, limit updatable fields (admins exempt)
    if (existing._count.submissions > 0 && user.role !== 'ADMIN') {
      const disallowedUpdateFields = Object.keys(input).filter(
        (field) => field !== 'title' && field !== 'description',
      );
      if (disallowedUpdateFields.length > 0) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Only title and description can be updated for assignments with graded submissions.',
        );
      }
    }

    const updatedAssignment = await tx.assignment.update({
      where: { id: assignmentId },
      data: input,
      include: assignmentInclude,
    });

    return toAssignmentDetail(updatedAssignment);
  });
};

export const deleteAssignment = async (user: AuthUser, assignmentId: string): Promise<void> => {
  if (user.role === 'STUDENT') {
    throw new AppError(403, 'FORBIDDEN', 'Students cannot delete assignments.');
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.assignment.findUnique({
      where: { id: assignmentId },
      select: { course: { select: { instructorId: true } } },
    });

    if (!existing) {
      throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', ASSIGNMENT_NOT_FOUND_MESSAGE);
    }

    // Ensure instructor owns the course
    if (user.role === 'INSTRUCTOR') {
      if (existing.course.instructorId !== user.id) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'You can only delete assignments for your own courses.',
        );
      }
    }

    await tx.assignment.delete({ where: { id: assignmentId } });
  });
};
