import type { EnrollmentStatus } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.ts';
import type { CourseDetail, CourseSummary } from './course.types.js';

export const courseInclude = {
  instructor: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  _count: {
    select: {
      enrollments: {
        where: {
          status: 'ENROLLED',
        },
      },
    },
  },
} satisfies Prisma.CourseInclude;

export type CourseWithRelations = Prisma.CourseGetPayload<{
  include: typeof courseInclude;
}>;

export const toCourseSummary = (course: CourseWithRelations): CourseSummary => {
  const enrolledCount = course._count.enrollments;

  return {
    id: course.id,
    code: course.code,
    title: course.title,
    credits: course.credits,
    capacity: course.capacity,
    term: course.term,
    scheduleDay: course.scheduleDay,
    startTime: course.startTime,
    endTime: course.endTime,
    room: course.room,
    status: course.status,
    instructor: course.instructor,
    enrolledCount,
    availableSeats: Math.max(course.capacity - enrolledCount, 0),
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
};

export const toCourseDetail = (
  course: CourseWithRelations,
  viewerEnrollmentStatus: EnrollmentStatus | null,
): CourseDetail => ({
  ...toCourseSummary(course),
  description: course.description,
  viewerEnrollmentStatus,
});
