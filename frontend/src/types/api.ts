export type Role = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

export type CourseStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';

export type EnrollmentStatus = 'ENROLLED' | 'DROPPED';

export type Weekday =
  'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserSummary = AuthUser;

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CourseDetail extends CourseSummary {
  description: string;
  viewerEnrollmentStatus: EnrollmentStatus | null;
}

export interface EnrollmentSummary {
  id: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  updatedAt: string;
}

export interface StudentCourse extends CourseSummary {
  enrollment: EnrollmentSummary;
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
  enrolledAt: string;
  updatedAt: string;
  student: RosterStudent;
}

export interface AssignmentSummary {
  id: string;
  courseId: string;
  title: string;
  dueAt: string;
  maxScore: number;
  createdAt: string;
  updatedAt: string;
  hasGradedSubmissions: boolean;
}

export interface AssignmentDetail extends AssignmentSummary {
  description: string;
  course: CourseSummary;
}

export interface SubmissionSummary {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: string;
  gradedAt: string | null;
  grade: number | null;
  isLate: boolean;
  feedback: string | null;
}

export interface SubmissionDetail extends SubmissionSummary {
  content: string;
  assignment: AssignmentSummary;
  student: RosterStudent;
}

export interface AnnouncementSummary {
  id: string;
  title: string;
  body: string;
  courseId: string | null;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
  course: { id: string; code: string; title: string } | null;
}

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
  submittedAt: string;
  gradedAt: string | null;
  grade: number | null;
}

export interface UpcomingAssignment {
  id: string;
  title: string;
  dueAt: string;
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
