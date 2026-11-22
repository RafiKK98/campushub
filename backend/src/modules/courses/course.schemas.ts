import { z } from 'zod';

export const COURSE_STATUSES = ['DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED'] as const;
export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use 24-hour HH:mm format.');

const courseFields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}-\d{4}$/, 'Course code must look like CSE-2201.'),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  credits: z.coerce.number().int().min(1).max(12),
  capacity: z.coerce.number().int().min(1).max(500),
  term: z.string().trim().min(1).max(50),
  scheduleDay: z.enum(WEEKDAYS),
  startTime: timeSchema,
  endTime: timeSchema,
  room: z.string().trim().min(1).max(50),
  status: z.enum(COURSE_STATUSES).optional(),
  instructorId: z.uuid(),
};

export const createCourseSchema = z.object(courseFields).superRefine((value, ctx) => {
  if (value.endTime <= value.startTime) {
    ctx.addIssue({
      code: 'custom',
      path: ['endTime'],
      message: 'End time must be after start time.',
    });
  }
});

export const updateCourseSchema = z
  .object(courseFields)
  .partial()
  .superRefine((value, ctx) => {
    if (value.startTime && value.endTime && value.endTime <= value.startTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'End time must be after start time.',
      });
    }
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const updateCourseStatusSchema = z.object({
  status: z.enum(COURSE_STATUSES),
});

export const courseIdParamSchema = z.object({
  id: z.uuid(),
});

export const courseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  term: z.string().trim().min(1).max(50).optional(),
  status: z.enum(COURSE_STATUSES).optional(),
  scheduleDay: z.enum(WEEKDAYS).optional(),
  instructorId: z.uuid().optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type UpdateCourseStatusInput = z.infer<typeof updateCourseStatusSchema>;
export type CourseIdParams = z.infer<typeof courseIdParamSchema>;
export type CourseListQuery = z.infer<typeof courseListQuerySchema>;
