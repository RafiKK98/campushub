import type { CourseStatus, EnrollmentStatus, Weekday } from '../../generated/prisma/enums.js';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CourseInstructor {
  id: string;
  name: string;
  email: string;
}

export interface CourseSummary {
  id: string;
  code: string;
  title: string;
  credits: number;
  capacity: number;
  term: string;
  scheduleDay: Weekday;
  startTime: string;
  endTime: string;
  room: string;
  status: CourseStatus;
  instructor: CourseInstructor;
  enrolledCount: number;
  availableSeats: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseDetail extends CourseSummary {
  description: string;
  viewerEnrollmentStatus: EnrollmentStatus | null;
}

export interface CourseListResult {
  courses: CourseSummary[];
  meta: PaginationMeta;
}

export interface EnrollmentSummary {
  id: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  updatedAt: Date;
}

export interface StudentCourse extends CourseSummary {
  enrollment: EnrollmentSummary;
}

export interface StudentCourseListResult {
  courses: StudentCourse[];
  meta: PaginationMeta;
}

export interface RosterStudent {
  id: string;
  name: string;
  email: string;
}

export interface RosterEntry {
  id: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  updatedAt: Date;
  student: RosterStudent;
}

export interface RosterResult {
  enrollments: RosterEntry[];
  meta: PaginationMeta;
}
