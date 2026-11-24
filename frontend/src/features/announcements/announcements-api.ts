import { apiRequest, requireMeta, toQueryString } from '../../lib/api-client';
import type { AnnouncementSummary, PaginationMeta } from '../../types/api';

export interface AnnouncementListParams {
  page?: number;
  limit?: number;
  search?: string;
  courseId?: string;
}

export interface AnnouncementListResult {
  announcements: AnnouncementSummary[];
  meta: PaginationMeta;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  courseId?: string | null;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
}

export const listAnnouncements = async (
  params: AnnouncementListParams,
): Promise<AnnouncementListResult> => {
  const response = await apiRequest<{ announcements: AnnouncementSummary[] }>(
    `/announcements${toQueryString({ ...params })}`,
  );

  return { announcements: response.data.announcements, meta: requireMeta(response.meta) };
};

export const createAnnouncement = async (
  input: CreateAnnouncementInput,
): Promise<AnnouncementSummary> => {
  const response = await apiRequest<{ announcement: AnnouncementSummary }>('/announcements', {
    method: 'POST',
    json: input,
  });

  return response.data.announcement;
};

export const updateAnnouncement = async (
  id: string,
  input: UpdateAnnouncementInput,
): Promise<AnnouncementSummary> => {
  const response = await apiRequest<{ announcement: AnnouncementSummary }>(`/announcements/${id}`, {
    method: 'PATCH',
    json: input,
  });

  return response.data.announcement;
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
  await apiRequest<undefined>(`/announcements/${id}`, { method: 'DELETE' });
};
