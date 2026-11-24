import { apiRequest, requireMeta, toQueryString } from '../../lib/api-client';
import type { AssignmentDetail, AssignmentSummary, PaginationMeta } from '../../types/api';

export interface AssignmentListParams {
  courseId?: string;
  page?: number;
  limit?: number;
}

export interface AssignmentListResult {
  assignments: AssignmentSummary[];
  meta: PaginationMeta;
}

export interface AssignmentInput {
  courseId: string;
  title: string;
  description: string;
  dueAt: string;
  maxScore: number;
}

export type AssignmentUpdateInput = Partial<Omit<AssignmentInput, 'courseId'>>;

export type AssignmentScope = 'instructor' | 'admin';

export const listAssignments = async (
  params: AssignmentListParams,
): Promise<AssignmentListResult> => {
  const response = await apiRequest<{ assignments: AssignmentSummary[] }>(
    `/assignments${toQueryString({ ...params })}`,
  );

  return { assignments: response.data.assignments, meta: requireMeta(response.meta) };
};

export const getAssignment = async (id: string): Promise<AssignmentDetail> => {
  const response = await apiRequest<{ assignment: AssignmentDetail }>(`/assignments/${id}`);
  return response.data.assignment;
};

export const createAssignment = async (
  scope: AssignmentScope,
  input: AssignmentInput,
): Promise<AssignmentDetail> => {
  const response = await apiRequest<{ assignment: AssignmentDetail }>(`/${scope}/assignments`, {
    method: 'POST',
    json: input,
  });

  return response.data.assignment;
};

export const updateAssignment = async (
  scope: AssignmentScope,
  id: string,
  input: AssignmentUpdateInput,
): Promise<AssignmentDetail> => {
  const response = await apiRequest<{ assignment: AssignmentDetail }>(
    `/${scope}/assignments/${id}`,
    {
      method: 'PATCH',
      json: input,
    },
  );

  return response.data.assignment;
};

export const deleteAssignment = async (scope: AssignmentScope, id: string): Promise<void> => {
  await apiRequest<undefined>(`/${scope}/assignments/${id}`, { method: 'DELETE' });
};
