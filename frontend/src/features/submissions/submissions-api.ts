import { ApiError, apiRequest, requireMeta, toQueryString } from '../../lib/api-client';
import type { PaginationMeta, SubmissionDetail } from '../../types/api';

export interface SubmissionListParams {
  assignmentId?: string;
  page?: number;
  limit?: number;
  search?: string;
  isGraded?: boolean;
}

export interface SubmissionListResult {
  submissions: SubmissionDetail[];
  meta: PaginationMeta;
}

export interface GradeInput {
  grade: number;
  feedback?: string;
}

export const getMySubmission = async (assignmentId: string): Promise<SubmissionDetail | null> => {
  try {
    const response = await apiRequest<{ submission: SubmissionDetail }>(
      `/assignments/${assignmentId}/my-submission`,
    );

    return response.data.submission;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'SUBMISSION_NOT_FOUND') {
      return null;
    }

    throw error;
  }
};

export const submitAssignment = async (
  assignmentId: string,
  content: string,
): Promise<SubmissionDetail> => {
  const response = await apiRequest<{ submission: SubmissionDetail }>(
    `/assignments/${assignmentId}/submit`,
    {
      method: 'POST',
      json: { content },
    },
  );

  return response.data.submission;
};

export const listStudentSubmissions = async (
  params: SubmissionListParams,
): Promise<SubmissionListResult> => {
  const response = await apiRequest<{ submissions: SubmissionDetail[] }>(
    `/student/submissions${toQueryString({ ...params })}`,
  );

  return { submissions: response.data.submissions, meta: requireMeta(response.meta) };
};

export const listAssignmentSubmissions = async (
  assignmentId: string,
  params: SubmissionListParams,
): Promise<SubmissionListResult> => {
  const response = await apiRequest<{ submissions: SubmissionDetail[] }>(
    `/instructor/assignments/${assignmentId}/submissions${toQueryString({ ...params })}`,
  );

  return { submissions: response.data.submissions, meta: requireMeta(response.meta) };
};

export const gradeSubmission = async (
  submissionId: string,
  input: GradeInput,
): Promise<SubmissionDetail> => {
  const response = await apiRequest<{ submission: SubmissionDetail }>(
    `/instructor/submissions/${submissionId}/grade`,
    {
      method: 'PATCH',
      json: input,
    },
  );

  return response.data.submission;
};
