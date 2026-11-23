import { z } from 'zod';

export const createAssignmentSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  dueAt: z.coerce.date().min(new Date(), 'Due date must be in the future.'),
  maxScore: z.coerce.number().int().min(1, 'Max score must be a positive integer.'),
});

export const updateAssignmentSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    dueAt: z.coerce.date().min(new Date(), 'Due date must be in the future.').optional(),
    maxScore: z.coerce.number().int().min(1, 'Max score must be a positive integer.').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update.',
  });

export const assignmentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const assignmentListQuerySchema = z.object({
  courseId: z.string().uuid().optional(), // Optional for admin/instructor, required for student
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type AssignmentIdParams = z.infer<typeof assignmentIdParamSchema>;
export type AssignmentListQuery = z.infer<typeof assignmentListQuerySchema>;
