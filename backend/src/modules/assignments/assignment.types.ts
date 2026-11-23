import type { CourseSummary } from '../courses/course.types.js';

export interface AssignmentSummary {
  id: string;
  courseId: string;
  title: string;
  dueAt: Date;
  maxScore: number;
  createdAt: Date;
  updatedAt: Date;
  hasGradedSubmissions: boolean; // Indicates if any submission for this assignment has been graded
}

export interface AssignmentDetail extends AssignmentSummary {
  description: string;
  course: CourseSummary;
}

export interface AssignmentListResult {
  assignments: AssignmentSummary[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
