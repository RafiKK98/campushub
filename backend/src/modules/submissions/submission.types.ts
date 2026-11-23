import type { AssignmentSummary } from '../assignments/assignment.types.js';
import type { RosterStudent } from '../courses/course.types.js';

export interface SubmissionSummary {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: Date;
  gradedAt: Date | null;
  grade: number | null;
  isLate: boolean;
  feedback: string | null;
}

export interface SubmissionDetail extends SubmissionSummary {
  content: string;
  assignment: AssignmentSummary;
  student: RosterStudent;
}

export interface SubmissionListResult {
  submissions: SubmissionDetail[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
