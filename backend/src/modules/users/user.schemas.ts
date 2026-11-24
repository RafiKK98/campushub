import { z } from 'zod';

export const userRoleSchema = z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT']);

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const passwordSchema = z.string().min(8).max(128);

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: emailSchema,
  role: userRoleSchema,
  password: passwordSchema,
  isActive: z.boolean().optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update.',
  });

export const userIdParamSchema = z.object({
  id: z.uuid(),
});

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  role: userRoleSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdParams = z.infer<typeof userIdParamSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
