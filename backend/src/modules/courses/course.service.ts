import type { EnrollmentStatus } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.ts';
import { AppError } from '../../errors/app-error.js';
import { hasPrismaErrorCode } from '../../lib/prisma-errors.js';
import { lockCourseRow } from '../../lib/row-lock.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.types.js';
import { courseInclude, toCourseDetail, toCourseSummary } from './course.mapper.js';
import type { CourseDetail, CourseListResult, PaginationMeta } from './course.types.js';
import type {
  CourseListQuery,
  CreateCourseInput,
  UpdateCourseInput,
  UpdateCourseStatusInput,
} from './course.schemas.js';

const COURSE_NOT_FOUND_MESSAGE = 'Course not found.';

const buildMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const ensureInstructor = async (
  db: Pick<Prisma.TransactionClient, 'user'>,
  instructorId: string,
): Promise<void> => {
  const instructor = await db.user.findUnique({
    where: { id: instructorId },
    select: { role: true, isActive: true },
  });

  if (!instructor || instructor.role !== 'INSTRUCTOR' || !instructor.isActive) {
    throw new AppError(
      400,
      'INVALID_INSTRUCTOR',
      'Instructor must be an active user with the INSTRUCTOR role.',
    );
  }
};

const assertTimeRange = (startTime: string, endTime: string): void => {
  if (endTime <= startTime) {
    throw new AppError(400, 'INVALID_TIME_RANGE', 'End time must be after start time.');
  }
};

const buildCourseWhere = (user: AuthUser, query: CourseListQuery): Prisma.CourseWhereInput => {
  const filters: Prisma.CourseWhereInput[] = [];

  if (query.search) {
    filters.push({
      OR: [
        { code: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }

  if (query.term) {
    filters.push({ term: { equals: query.term, mode: 'insensitive' } });
  }

  if (query.scheduleDay) {
    filters.push({ scheduleDay: query.scheduleDay });
  }

  if (query.instructorId) {
    if (user.role === 'ADMIN') {
      filters.push({ instructorId: query.instructorId });
    } else if (user.role === 'INSTRUCTOR' && query.instructorId === user.id) {
      filters.push({ instructorId: user.id });
    } else {
      throw new AppError(403, 'FORBIDDEN', 'You cannot filter by that instructor.');
    }
  }

  if (user.role === 'STUDENT') {
    if (query.status && query.status !== 'OPEN') {
      throw new AppError(400, 'INVALID_FILTER', 'Students can only browse open courses.');
    }

    filters.push({ status: 'OPEN' });
  } else if (user.role === 'INSTRUCTOR') {
    filters.push({
      OR: [{ status: 'OPEN' }, { instructorId: user.id }],
    });

    if (query.status) {
      filters.push({ status: query.status });
    }
  } else if (query.status) {
    filters.push({ status: query.status });
  }

  return filters.length > 0 ? { AND: filters } : {};
};

export const listCourses = async (
  user: AuthUser,
  query: CourseListQuery,
): Promise<CourseListResult> => {
  const where = buildCourseWhere(user, query);
  const skip = (query.page - 1) * query.limit;

  const [total, courses] = await prisma.$transaction([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      include: courseInclude,
      orderBy: [{ term: 'asc' }, { code: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    courses: courses.map(toCourseSummary),
    meta: buildMeta(query.page, query.limit, total),
  };
};

export const listInstructorCourses = async (
  user: AuthUser,
  query: CourseListQuery,
): Promise<CourseListResult> => {
  return listCourses(user, { ...query, instructorId: user.id });
};

export const getCourseDetail = async (user: AuthUser, courseId: string): Promise<CourseDetail> => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: courseInclude,
  });

  if (!course) {
    throw new AppError(404, 'COURSE_NOT_FOUND', COURSE_NOT_FOUND_MESSAGE);
  }

  let viewerEnrollmentStatus: EnrollmentStatus | null = null;

  if (user.role === 'STUDENT') {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: user.id,
          courseId,
        },
      },
      select: { status: true },
    });

    viewerEnrollmentStatus = enrollment?.status ?? null;
  }

  const isVisible =
    user.role === 'ADMIN' ||
    (user.role === 'INSTRUCTOR' &&
      (course.instructor.id === user.id || course.status === 'OPEN')) ||
    (user.role === 'STUDENT' &&
      (course.status === 'OPEN' || viewerEnrollmentStatus === 'ENROLLED'));

  if (!isVisible) {
    throw new AppError(404, 'COURSE_NOT_FOUND', COURSE_NOT_FOUND_MESSAGE);
  }

  return toCourseDetail(course, viewerEnrollmentStatus);
};

export const createCourse = async (input: CreateCourseInput): Promise<CourseDetail> => {
  await ensureInstructor(prisma, input.instructorId);
  assertTimeRange(input.startTime, input.endTime);

  try {
    const course = await prisma.course.create({
      data: {
        code: input.code,
        title: input.title,
        description: input.description,
        credits: input.credits,
        capacity: input.capacity,
        term: input.term,
        scheduleDay: input.scheduleDay,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room,
        status: input.status ?? 'DRAFT',
        instructorId: input.instructorId,
      },
      include: courseInclude,
    });

    return toCourseDetail(course, null);
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2002')) {
      throw new AppError(409, 'COURSE_CODE_EXISTS', 'A course with this code already exists.');
    }

    throw error;
  }
};

export const updateCourse = async (
  courseId: string,
  input: UpdateCourseInput,
): Promise<CourseDetail> => {
  return prisma.$transaction(async (tx) => {
    await lockCourseRow(tx, courseId);

    const existing = await tx.course.findUnique({
      where: { id: courseId },
      include: courseInclude,
    });

    if (!existing) {
      throw new AppError(404, 'COURSE_NOT_FOUND', COURSE_NOT_FOUND_MESSAGE);
    }

    if (input.instructorId) {
      await ensureInstructor(tx, input.instructorId);
    }

    const startTime = input.startTime ?? existing.startTime;
    const endTime = input.endTime ?? existing.endTime;
    assertTimeRange(startTime, endTime);

    if (input.capacity !== undefined) {
      const enrolledCount = await tx.enrollment.count({
        where: { courseId, status: 'ENROLLED' },
      });

      if (input.capacity < enrolledCount) {
        throw new AppError(
          409,
          'CAPACITY_BELOW_ENROLLED',
          `Capacity cannot be lower than the ${enrolledCount} currently enrolled students.`,
        );
      }
    }

    try {
      const updated = await tx.course.update({
        where: { id: courseId },
        data: input,
        include: courseInclude,
      });

      return toCourseDetail(updated, null);
    } catch (error) {
      if (hasPrismaErrorCode(error, 'P2002')) {
        throw new AppError(409, 'COURSE_CODE_EXISTS', 'A course with this code already exists.');
      }

      if (hasPrismaErrorCode(error, 'P2025')) {
        throw new AppError(404, 'COURSE_NOT_FOUND', COURSE_NOT_FOUND_MESSAGE);
      }

      throw error;
    }
  });
};

export const updateCourseStatus = async (
  courseId: string,
  input: UpdateCourseStatusInput,
): Promise<CourseDetail> => {
  const existing = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'COURSE_NOT_FOUND', COURSE_NOT_FOUND_MESSAGE);
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: { status: input.status },
    include: courseInclude,
  });

  return toCourseDetail(updated, null);
};

export const deleteCourse = async (courseId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await lockCourseRow(tx, courseId);

    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      throw new AppError(404, 'COURSE_NOT_FOUND', COURSE_NOT_FOUND_MESSAGE);
    }

    const enrollmentCount = await tx.enrollment.count({ where: { courseId } });
    const assignmentCount = await tx.assignment.count({ where: { courseId } });
    const announcementCount = await tx.announcement.count({ where: { courseId } });

    if (enrollmentCount > 0 || assignmentCount > 0 || announcementCount > 0) {
      throw new AppError(
        409,
        'COURSE_HAS_DEPENDENCIES',
        'Course has dependent records and cannot be deleted. Archive it instead.',
        [
          {
            path: 'enrollments',
            message: `${enrollmentCount} enrollment(s)`,
            code: 'DEPENDENCY_COUNT',
          },
          {
            path: 'assignments',
            message: `${assignmentCount} assignment(s)`,
            code: 'DEPENDENCY_COUNT',
          },
          {
            path: 'announcements',
            message: `${announcementCount} announcement(s)`,
            code: 'DEPENDENCY_COUNT',
          },
        ],
      );
    }

    await tx.course.delete({ where: { id: courseId } });
  });
};
