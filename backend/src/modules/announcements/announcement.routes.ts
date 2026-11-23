import { Router, type Request, type Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  announcementIdParamSchema,
  announcementListQuerySchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  type AnnouncementIdParams,
  type AnnouncementListQuery,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from './announcement.schemas.js';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from './announcement.service.js';

const getValidatedParams = <T>(response: Response): T => response.locals.validatedParams as T;
const getValidatedQuery = <T>(response: Response): T => response.locals.validatedQuery as T;
const getAuthenticatedUser = (request: Request): AuthUser => {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  return request.user;
};

export const announcementRouter = Router();

announcementRouter.use(authenticate);

announcementRouter.get(
  '/',
  validateQuery(announcementListQuerySchema),
  async (request, response, next) => {
    try {
      const query = getValidatedQuery<AnnouncementListQuery>(response);
      const result = await listAnnouncements(getAuthenticatedUser(request), query);
      response
        .status(200)
        .json({ data: { announcements: result.announcements }, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);

announcementRouter.post(
  '/',
  requireRole('ADMIN', 'INSTRUCTOR'),
  validateBody(createAnnouncementSchema),
  async (request, response, next) => {
    try {
      const announcement = await createAnnouncement(
        getAuthenticatedUser(request),
        request.body as CreateAnnouncementInput,
      );
      response.status(201).json({ data: { announcement } });
    } catch (error) {
      next(error);
    }
  },
);

announcementRouter.patch(
  '/:id',
  validateParams(announcementIdParamSchema),
  validateBody(updateAnnouncementSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<AnnouncementIdParams>(response);
      const announcement = await updateAnnouncement(
        getAuthenticatedUser(request),
        id,
        request.body as UpdateAnnouncementInput,
      );
      response.status(200).json({ data: { announcement } });
    } catch (error) {
      next(error);
    }
  },
);

announcementRouter.delete(
  '/:id',
  validateParams(announcementIdParamSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<AnnouncementIdParams>(response);
      await deleteAnnouncement(getAuthenticatedUser(request), id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);
