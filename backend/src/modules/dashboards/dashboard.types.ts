import type { AnnouncementSummary } from '../announcements/announcement.types.js';
import type { CourseSummary, StudentCourse } from '../courses/course.types.js';

export interface AdminOverview {
  totalStudents: number;
  totalInstructors: number;
  activeCourses: number;
  totalEnrollments: number;
}

export interface InstructorOverview {
  totalCourses: number;
  totalStudents: number;
  totalAssignments: number;
  pendingGrading: number;
  gradedSubmissions: number;
  courses: CourseSummary[];
}

export interface UpcomingAssignmentSubmission {
  id: string;
  submittedAt: Date;
  gradedAt: Date | null;
  grade: number | null;
}

export interface UpcomingAssignment {
  id: string;
  title: string;
  dueAt: Date;
  maxScore: number;
  course: { id: string; code: string; title: string };
  submission: UpcomingAssignmentSubmission | null;
}

export interface GradeSummary {
  gradedSubmissions: number;
  averagePercentage: number | null;
}

export interface StudentOverview {
  enrolledCoursesCount: number;
  courses: StudentCourse[];
  upcomingAssignments: UpcomingAssignment[];
  recentAnnouncements: AnnouncementSummary[];
  gradeSummary: GradeSummary;
}
