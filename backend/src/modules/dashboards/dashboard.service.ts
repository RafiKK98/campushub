import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.types.js';
import { listAnnouncements } from '../announcements/announcement.service.js';
import { listInstructorCourses } from '../courses/course.service.js';
import { listStudentCourses } from '../enrollments/enrollment.service.js';
import type {
  AdminOverview,
  GradeSummary,
  InstructorOverview,
  StudentOverview,
  UpcomingAssignment,
} from './dashboard.types.js';

const UPCOMING_ASSIGNMENTS_LIMIT = 5;
const RECENT_ANNOUNCEMENTS_LIMIT = 5;
const COURSE_LIST_LIMIT = 100;

export const getAdminOverview = async (): Promise<AdminOverview> => {
  const [totalStudents, totalInstructors, activeCourses, totalEnrollments] =
    await prisma.$transaction([
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'INSTRUCTOR' } }),
      prisma.course.count({ where: { status: 'OPEN' } }),
      prisma.enrollment.count({ where: { status: 'ENROLLED' } }),
    ]);

  return {
    totalStudents,
    totalInstructors,
    activeCourses,
    totalEnrollments,
  };
};

export const getInstructorOverview = async (user: AuthUser): Promise<InstructorOverview> => {
  const courseResult = await listInstructorCourses(user, {
    page: 1,
    limit: COURSE_LIST_LIMIT,
  });

  const [totalAssignments, pendingGrading, gradedSubmissions, enrolledStudents] =
    await prisma.$transaction([
      prisma.assignment.count({ where: { course: { instructorId: user.id } } }),
      prisma.submission.count({
        where: { gradedAt: null, assignment: { course: { instructorId: user.id } } },
      }),
      prisma.submission.count({
        where: { gradedAt: { not: null }, assignment: { course: { instructorId: user.id } } },
      }),
      prisma.enrollment.groupBy({
        by: ['studentId'],
        where: { status: 'ENROLLED', course: { instructorId: user.id } },
      }),
    ]);

  return {
    totalCourses: courseResult.meta.total,
    totalStudents: enrolledStudents.length,
    totalAssignments,
    pendingGrading,
    gradedSubmissions,
    courses: courseResult.courses,
  };
};

export const getStudentOverview = async (user: AuthUser): Promise<StudentOverview> => {
  const courseResult = await listStudentCourses(user.id, {
    page: 1,
    limit: COURSE_LIST_LIMIT,
  });

  const [upcomingAssignmentsRaw, announcementResult, gradedSubmissionsRaw] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        dueAt: { gte: new Date() },
        course: {
          enrollments: { some: { studentId: user.id, status: 'ENROLLED' } },
        },
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        maxScore: true,
        course: { select: { id: true, code: true, title: true } },
        submissions: {
          where: { studentId: user.id },
          select: { id: true, submittedAt: true, gradedAt: true, score: true },
        },
      },
      orderBy: { dueAt: 'asc' },
      take: UPCOMING_ASSIGNMENTS_LIMIT,
    }),
    listAnnouncements(user, { page: 1, limit: RECENT_ANNOUNCEMENTS_LIMIT }),
    prisma.submission.findMany({
      where: {
        studentId: user.id,
        gradedAt: { not: null },
        assignment: {
          course: {
            enrollments: { some: { studentId: user.id, status: 'ENROLLED' } },
          },
        },
      },
      select: { score: true, assignment: { select: { maxScore: true } } },
    }),
  ]);

  const upcomingAssignments: UpcomingAssignment[] = upcomingAssignmentsRaw.map((assignment) => {
    const submission = assignment.submissions[0];

    return {
      id: assignment.id,
      title: assignment.title,
      dueAt: assignment.dueAt,
      maxScore: assignment.maxScore,
      course: assignment.course,
      submission: submission
        ? {
            id: submission.id,
            submittedAt: submission.submittedAt,
            gradedAt: submission.gradedAt,
            grade: submission.score,
          }
        : null,
    };
  });

  let gradedCount = 0;
  let totalPercentage = 0;

  for (const submission of gradedSubmissionsRaw) {
    if (submission.score === null) {
      continue;
    }

    totalPercentage += (submission.score / submission.assignment.maxScore) * 100;
    gradedCount += 1;
  }

  const gradeSummary: GradeSummary = {
    gradedSubmissions: gradedCount,
    averagePercentage:
      gradedCount > 0 ? Math.round((totalPercentage / gradedCount) * 100) / 100 : null,
  };

  return {
    enrolledCoursesCount: courseResult.meta.total,
    courses: courseResult.courses,
    upcomingAssignments,
    recentAnnouncements: announcementResult.announcements,
    gradeSummary,
  };
};
