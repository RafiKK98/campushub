import type { EnrollmentStatus } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.ts';
import { AppError } from '../../errors/app-error.js';
import { hasPrismaErrorCode } from '../../lib/prisma-errors.js';
import { prisma } from '../../lib/prisma.js';
import { lockCourseRow } from '../../lib/row-lock.js';
import type { AuthUser } from '../auth/auth.types.js';
import { courseInclude, toCourseSummary } from '../courses/course.mapper.js';
import type {
  EnrollmentSummary,
  PaginationMeta,
  RosterEntry,
  RosterResult,
  StudentCourse,
  StudentCourseListResult,
} from '../courses/course.types.js';
import type { RosterQuery, StudentCourseListQuery } from './enrollment.schemas.js';

const COURSE_NOT_FOUND_MESSAGE = 'Course not found.';

const buildMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const toEnrollmentSummary = (enrollment: {
  id: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  updatedAt: Date;
}): EnrollmentSummary => ({
  id: enrollment.id,
  courseId: enrollment.courseId,
  status: enrollment.status,
  enrolledAt: enrollment.enrolledAt,
  updatedAt: enrollment.updatedAt,
});

export const enrollStudent = async (
  studentId: string,
  courseId: string,
): Promise<EnrollmentSummary> => {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockCourseRow(tx, courseId);

      const course = await tx.course.findUnique({
        where: { id: courseId },
        select: { id: true, status: true, capacity: true },
      });

      if (!course) {
        throw new AppError(404, 'COURSE_NOT_FOUND', COURSE_NOT_FOUND_MESSAGE);
      }

      if (course.status !== 'OPEN') {
        throw new AppError(409, 'COURSE_NOT_OPEN', 'Only open courses can be joined.');
      }

      const existing = await tx.enrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId,
            courseId,
          },
        },
        select: { id: true, status: true },
      });

      if (existing?.status === 'ENROLLED') {
        throw new AppError(409, 'ALREADY_ENROLLED', 'You are already enrolled in this course.');
      }

      const enrolledCount = await tx.enrollment.count({
        where: { courseId, status: 'ENROLLED' },
      });

      if (enrolledCount >= course.capacity) {
        throw new AppError(409, 'COURSE_FULL', 'This course is at capacity.');
      }

      const enrollment = existing
        ? await tx.enrollment.update({
            where: { id: existing.id },
            data: { status: 'ENROLLED', enrolledAt: new Date() },
          })
        : await tx.enrollment.create({
            data: {
              studentId,
              courseId,
              status: 'ENROLLED',
            },
          });

      return toEnrollmentSummary(enrollment);
    });
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2002')) {
      throw new AppError(409, 'ALREADY_ENROLLED', 'You are already enrolled in this course.');
    }

    if (hasPrismaErrorCode(error, 'P2034')) {
      throw new AppError(
        409,
        'ENROLLMENT_CONFLICT',
        'Enrollment could not be completed due to a concurrent update. Please retry.',
      );
    }

    throw error;
  }
};

export const dropCourse = async (studentId: string, courseId: string): Promise<void> => {
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_courseId: {
        studentId,
        courseId,
      },
    },
    select: { id: true, status: true },
  });

  if (!enrollment) {
    throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found.');
  }

  if (enrollment.status === 'ENROLLED') {
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'DROPPED' },
    });
  }
};

export const listStudentCourses = async (
  studentId: string,
  query: StudentCourseListQuery,
): Promise<StudentCourseListResult> => {
  const courseFilters: Prisma.CourseWhereInput = {};

  if (query.search) {
    courseFilters.OR = [
      { code: { contains: query.search, mode: 'insensitive' } },
      { title: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.term) {
    courseFilters.term = { equals: query.term, mode: 'insensitive' };
  }

  const filters: Prisma.EnrollmentWhereInput[] = [{ studentId, status: 'ENROLLED' }];

  if (Object.keys(courseFilters).length > 0) {
    filters.push({ course: courseFilters });
  }

  const where: Prisma.EnrollmentWhereInput = { AND: filters };
  const skip = (query.page - 1) * query.limit;

  const [total, enrollments] = await prisma.$transaction([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({
      where,
      include: {
        course: {
          include: courseInclude,
        },
      },
      orderBy: { course: { code: 'asc' } },
      skip,
      take: query.limit,
    }),
  ]);

  const courses: StudentCourse[] = enrollments.map((enrollment) => ({
    ...toCourseSummary(enrollment.course),
    enrollment: toEnrollmentSummary(enrollment),
  }));

  return {
    courses,
    meta: buildMeta(query.page, query.limit, total),
  };
};

export const getRoster = async (
  user: AuthUser,
  courseId: string,
  query: RosterQuery,
): Promise<RosterResult> => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });

  if (!course) {
    throw new AppError(404, 'COURSE_NOT_FOUND', COURSE_NOT_FOUND_MESSAGE);
  }

  if (user.role !== 'ADMIN' && user.role !== 'INSTRUCTOR') {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions.');
  }

  if (user.role === 'INSTRUCTOR' && course.instructorId !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view rosters for your own courses.');
  }

  const studentFilters: Prisma.UserWhereInput = {};

  if (query.search) {
    studentFilters.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const filters: Prisma.EnrollmentWhereInput[] = [{ courseId, status: query.status }];

  if (Object.keys(studentFilters).length > 0) {
    filters.push({ student: studentFilters });
  }

  const where: Prisma.EnrollmentWhereInput = { AND: filters };
  const skip = (query.page - 1) * query.limit;

  const [total, enrollments] = await prisma.$transaction([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { enrolledAt: 'asc' },
      skip,
      take: query.limit,
    }),
  ]);

  const roster: RosterEntry[] = enrollments.map((enrollment) => ({
    id: enrollment.id,
    courseId: enrollment.courseId,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt,
    updatedAt: enrollment.updatedAt,
    student: enrollment.student,
  }));

  return {
    enrollments: roster,
    meta: buildMeta(query.page, query.limit, total),
  };
};
