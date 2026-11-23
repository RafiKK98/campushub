import type { Prisma } from '../../generated/prisma/client.ts';
import { AppError } from '../../errors/app-error.js';
import { hasPrismaErrorCode } from '../../lib/prisma-errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { PaginationMeta } from '../courses/course.types.js';
import type {
  AnnouncementListQuery,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from './announcement.schemas.js';
import type { AnnouncementListResult, AnnouncementSummary } from './announcement.types.js';

const ANNOUNCEMENT_NOT_FOUND_MESSAGE = 'Announcement not found.';
const COURSE_NOT_FOUND_MESSAGE = 'Course not found.';

const buildMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const announcementInclude = {
  author: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  course: {
    select: {
      id: true,
      code: true,
      title: true,
    },
  },
} satisfies Prisma.AnnouncementInclude;

export type AnnouncementWithRelations = Prisma.AnnouncementGetPayload<{
  include: typeof announcementInclude;
}>;

export const toAnnouncementSummary = (
  announcement: AnnouncementWithRelations,
): AnnouncementSummary => ({
  id: announcement.id,
  title: announcement.title,
  body: announcement.body,
  courseId: announcement.courseId,
  publishedAt: announcement.publishedAt,
  createdAt: announcement.createdAt,
  updatedAt: announcement.updatedAt,
  author: announcement.author,
  course: announcement.course,
});

const buildAnnouncementWhere = (
  user: AuthUser,
  query: AnnouncementListQuery,
): Prisma.AnnouncementWhereInput => {
  const filters: Prisma.AnnouncementWhereInput[] = [];

  if (query.courseId) {
    filters.push({ courseId: query.courseId });
  }

  if (query.search) {
    filters.push({
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }

  if (user.role === 'INSTRUCTOR') {
    // Global announcements plus announcements for courses the instructor owns
    filters.push({
      OR: [{ courseId: null }, { course: { instructorId: user.id } }],
    });
  } else if (user.role === 'STUDENT') {
    // Global announcements plus announcements for courses the student is enrolled in
    filters.push({
      OR: [
        { courseId: null },
        {
          course: {
            enrollments: {
              some: { studentId: user.id, status: 'ENROLLED' },
            },
          },
        },
      ],
    });
  }

  // ADMIN sees all announcements; any courseId filter is applied above.
  return filters.length > 0 ? { AND: filters } : {};
};

export const listAnnouncements = async (
  user: AuthUser,
  query: AnnouncementListQuery,
): Promise<AnnouncementListResult> => {
  const where = buildAnnouncementWhere(user, query);
  const skip = (query.page - 1) * query.limit;

  const [total, announcements] = await prisma.$transaction([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      include: announcementInclude,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    announcements: announcements.map(toAnnouncementSummary),
    meta: buildMeta(query.page, query.limit, total),
  };
};

export const createAnnouncement = async (
  user: AuthUser,
  input: CreateAnnouncementInput,
): Promise<AnnouncementSummary> => {
  if (user.role === 'STUDENT') {
    throw new AppError(403, 'FORBIDDEN', 'Students cannot create announcements.');
  }

  let courseId: string | null = null;

  if (user.role === 'ADMIN') {
    if (input.courseId) {
      throw new AppError(403, 'FORBIDDEN', 'Administrators can only publish global announcements.');
    }
  } else {
    if (!input.courseId) {
      throw new AppError(
        400,
        'COURSE_REQUIRED',
        'Instructors must specify a course for their announcement.',
      );
    }

    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
      select: { instructorId: true },
    });

    if (!course) {
      throw new AppError(404, 'COURSE_NOT_FOUND', COURSE_NOT_FOUND_MESSAGE);
    }

    if (course.instructorId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only post announcements for your own courses.');
    }

    courseId = input.courseId;
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      courseId,
      authorId: user.id,
    },
    include: announcementInclude,
  });

  return toAnnouncementSummary(announcement);
};

export const updateAnnouncement = async (
  user: AuthUser,
  announcementId: string,
  input: UpdateAnnouncementInput,
): Promise<AnnouncementSummary> => {
  if (user.role === 'STUDENT') {
    throw new AppError(403, 'FORBIDDEN', 'Students cannot update announcements.');
  }

  const existing = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, authorId: true },
  });

  if (!existing) {
    throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', ANNOUNCEMENT_NOT_FOUND_MESSAGE);
  }

  if (user.role !== 'ADMIN' && existing.authorId !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only update your own announcements.');
  }

  try {
    const updated = await prisma.announcement.update({
      where: { id: announcementId },
      data: input,
      include: announcementInclude,
    });

    return toAnnouncementSummary(updated);
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2025')) {
      throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', ANNOUNCEMENT_NOT_FOUND_MESSAGE);
    }

    throw error;
  }
};

export const deleteAnnouncement = async (user: AuthUser, announcementId: string): Promise<void> => {
  if (user.role === 'STUDENT') {
    throw new AppError(403, 'FORBIDDEN', 'Students cannot delete announcements.');
  }

  const existing = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, authorId: true },
  });

  if (!existing) {
    throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', ANNOUNCEMENT_NOT_FOUND_MESSAGE);
  }

  if (user.role !== 'ADMIN' && existing.authorId !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only delete your own announcements.');
  }

  try {
    await prisma.announcement.delete({ where: { id: announcementId } });
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2025')) {
      throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', ANNOUNCEMENT_NOT_FOUND_MESSAGE);
    }

    throw error;
  }
};
