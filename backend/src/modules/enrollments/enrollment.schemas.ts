import { z } from 'zod';

export const ENROLLMENT_STATUSES = ['ENROLLED', 'DROPPED'] as const;

export const rosterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  status: z.enum(ENROLLMENT_STATUSES).default('ENROLLED'),
});

export const studentCourseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  term: z.string().trim().min(1).max(50).optional(),
});

export type RosterQuery = z.infer<typeof rosterQuerySchema>;
export type StudentCourseListQuery = z.infer<typeof studentCourseListQuerySchema>;
