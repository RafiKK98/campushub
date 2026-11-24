import { apiRequest, requireMeta, toQueryString } from '../../lib/api-client';
import type {
  CourseDetail,
  CourseStatus,
  CourseSummary,
  EnrollmentSummary,
  PaginationMeta,
  RosterEntry,
  StudentCourse,
  Weekday,
} from '../../types/api';

export interface CourseListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CourseStatus;
  term?: string;
  scheduleDay?: Weekday;
  instructorId?: string;
}

export interface CourseListResult {
  courses: CourseSummary[];
  meta: PaginationMeta;
}

export interface StudentCourseListResult {
  courses: StudentCourse[];
  meta: PaginationMeta;
}

export interface RosterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ENROLLED' | 'DROPPED';
}

export interface RosterResult {
  enrollments: RosterEntry[];
  meta: PaginationMeta;
}

export interface CourseInput {
  code: string;
  title: string;
  description: string;
  credits: number;
  capacity: number;
  term: string;
  scheduleDay: Weekday;
  startTime: string;
  endTime: string;
  room: string;
  status?: CourseStatus;
  instructorId: string;
}

export type CourseUpdateInput = Partial<CourseInput>;

export type RosterScope = 'admin' | 'instructor';

export const listCourses = async (params: CourseListParams): Promise<CourseListResult> => {
  const response = await apiRequest<{ courses: CourseSummary[] }>(
    `/courses${toQueryString({ ...params })}`,
  );

  return { courses: response.data.courses, meta: requireMeta(response.meta) };
};

export const listAdminCourses = async (params: CourseListParams): Promise<CourseListResult> => {
  const response = await apiRequest<{ courses: CourseSummary[] }>(
    `/admin/courses${toQueryString({ ...params })}`,
  );

  return { courses: response.data.courses, meta: requireMeta(response.meta) };
};

export const listInstructorCourses = async (
  params: CourseListParams,
): Promise<CourseListResult> => {
  const response = await apiRequest<{ courses: CourseSummary[] }>(
    `/instructor/courses${toQueryString({ ...params })}`,
  );

  return { courses: response.data.courses, meta: requireMeta(response.meta) };
};

export const listStudentCourses = async (
  params: CourseListParams,
): Promise<StudentCourseListResult> => {
  const response = await apiRequest<{ courses: StudentCourse[] }>(
    `/student/courses${toQueryString({ ...params })}`,
  );

  return { courses: response.data.courses, meta: requireMeta(response.meta) };
};

export const getCourse = async (id: string): Promise<CourseDetail> => {
  const response = await apiRequest<{ course: CourseDetail }>(`/courses/${id}`);
  return response.data.course;
};

export const createCourse = async (input: CourseInput): Promise<CourseDetail> => {
  const response = await apiRequest<{ course: CourseDetail }>('/admin/courses', {
    method: 'POST',
    json: input,
  });

  return response.data.course;
};

export const updateCourse = async (id: string, input: CourseUpdateInput): Promise<CourseDetail> => {
  const response = await apiRequest<{ course: CourseDetail }>(`/admin/courses/${id}`, {
    method: 'PATCH',
    json: input,
  });

  return response.data.course;
};

export const updateCourseStatus = async (
  id: string,
  status: CourseStatus,
): Promise<CourseDetail> => {
  const response = await apiRequest<{ course: CourseDetail }>(`/admin/courses/${id}/status`, {
    method: 'PATCH',
    json: { status },
  });

  return response.data.course;
};

export const deleteCourse = async (id: string): Promise<void> => {
  await apiRequest<undefined>(`/admin/courses/${id}`, { method: 'DELETE' });
};

export const getRoster = async (
  scope: RosterScope,
  courseId: string,
  params: RosterParams,
): Promise<RosterResult> => {
  const response = await apiRequest<{ enrollments: RosterEntry[] }>(
    `/${scope}/courses/${courseId}/roster${toQueryString({ ...params })}`,
  );

  return { enrollments: response.data.enrollments, meta: requireMeta(response.meta) };
};

export const enrollInCourse = async (id: string): Promise<EnrollmentSummary> => {
  const response = await apiRequest<{ enrollment: EnrollmentSummary }>(`/courses/${id}/enroll`, {
    method: 'POST',
  });

  return response.data.enrollment;
};

export const dropCourse = async (id: string): Promise<void> => {
  await apiRequest<undefined>(`/courses/${id}/enroll`, { method: 'DELETE' });
};
