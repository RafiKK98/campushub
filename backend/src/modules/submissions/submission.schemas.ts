import { z } from 'zod';

export const submitSubmissionSchema = z.object({
  content: z.string().trim().min(1, 'Submission content cannot be empty.').max(10000),
});

export const gradeSubmissionSchema = z.object({
  grade: z.coerce.number().int().min(0, 'Grade cannot be negative.'),
  feedback: z.string().trim().max(5000).optional(),
});

export const submissionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const submissionListQuerySchema = z.object({
  assignmentId: z.string().uuid().optional(), // Required for instructor/admin, optional for student
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(), // For student name/email search in roster-like views
  isGraded: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
});

export type SubmitSubmissionInput = z.infer<typeof submitSubmissionSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export type SubmissionIdParams = z.infer<typeof submissionIdParamSchema>;
export type SubmissionListQuery = z.infer<typeof submissionListQuerySchema>;
