import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  courseId: z.uuid().nullable().optional(),
});

export const updateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(5000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update.',
  });

export const announcementIdParamSchema = z.object({
  id: z.uuid(),
});

export const announcementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  courseId: z.uuid().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type AnnouncementIdParams = z.infer<typeof announcementIdParamSchema>;
export type AnnouncementListQuery = z.infer<typeof announcementListQuerySchema>;
