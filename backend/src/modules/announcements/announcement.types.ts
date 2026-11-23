import type { PaginationMeta } from '../courses/course.types.js';

export interface AnnouncementAuthor {
  id: string;
  name: string;
  email: string;
}

export interface AnnouncementCourseRef {
  id: string;
  code: string;
  title: string;
}

export interface AnnouncementSummary {
  id: string;
  title: string;
  body: string;
  courseId: string | null;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  author: AnnouncementAuthor;
  course: AnnouncementCourseRef | null;
}

export interface AnnouncementListResult {
  announcements: AnnouncementSummary[];
  meta: PaginationMeta;
}
