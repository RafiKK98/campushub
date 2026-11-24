import { Router, type Request, type Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  userListQuerySchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserIdParams,
  type UserListQuery,
} from './user.schemas.js';
import { createUser, getUserById, listUsers, updateUser } from './user.service.js';

const getValidatedParams = <T>(response: Response): T => response.locals.validatedParams as T;
const getValidatedQuery = <T>(response: Response): T => response.locals.validatedQuery as T;
const getAuthenticatedUser = (request: Request): AuthUser => {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  return request.user;
};

export const adminUserRouter = Router();

adminUserRouter.use(authenticate, requireRole('ADMIN'));

adminUserRouter.get('/', validateQuery(userListQuerySchema), async (request, response, next) => {
  try {
    const query = getValidatedQuery<UserListQuery>(response);
    const result = await listUsers(query);
    response.status(200).json({ data: { users: result.users }, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

adminUserRouter.post('/', validateBody(createUserSchema), async (request, response, next) => {
  try {
    const user = await createUser(request.body as CreateUserInput);
    response.status(201).json({ data: { user } });
  } catch (error) {
    next(error);
  }
});

adminUserRouter.get('/:id', validateParams(userIdParamSchema), async (request, response, next) => {
  try {
    const { id } = getValidatedParams<UserIdParams>(response);
    const user = await getUserById(id);
    response.status(200).json({ data: { user } });
  } catch (error) {
    next(error);
  }
});

adminUserRouter.patch(
  '/:id',
  validateParams(userIdParamSchema),
  validateBody(updateUserSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<UserIdParams>(response);
      const user = await updateUser(
        getAuthenticatedUser(request),
        id,
        request.body as UpdateUserInput,
      );
      response.status(200).json({ data: { user } });
    } catch (error) {
      next(error);
    }
  },
);
