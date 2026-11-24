import { apiRequest } from '../../lib/api-client';
import type { AdminOverview, InstructorOverview, StudentOverview } from '../../types/api';

export const getAdminOverview = async (): Promise<AdminOverview> => {
  const response = await apiRequest<{ overview: AdminOverview }>('/admin/overview');
  return response.data.overview;
};

export const getInstructorOverview = async (): Promise<InstructorOverview> => {
  const response = await apiRequest<{ overview: InstructorOverview }>('/instructor/overview');
  return response.data.overview;
};

export const getStudentOverview = async (): Promise<StudentOverview> => {
  const response = await apiRequest<{ overview: StudentOverview }>('/student/overview');
  return response.data.overview;
};
