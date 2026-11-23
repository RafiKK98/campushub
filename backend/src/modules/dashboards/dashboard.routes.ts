import { Router, type Request } from 'express';
import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  getAdminOverview,
  getInstructorOverview,
  getStudentOverview,
} from './dashboard.service.js';

const getAuthenticatedUser = (request: Request): AuthUser => {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  return request.user;
};

export const adminDashboardRouter = Router();

adminDashboardRouter.use(authenticate, requireRole('ADMIN'));

adminDashboardRouter.get('/', async (_request, response, next) => {
  try {
    const overview = await getAdminOverview();
    response.status(200).json({ data: { overview } });
  } catch (error) {
    next(error);
  }
});

export const instructorDashboardRouter = Router();

instructorDashboardRouter.use(authenticate, requireRole('INSTRUCTOR'));

instructorDashboardRouter.get('/', async (request, response, next) => {
  try {
    const overview = await getInstructorOverview(getAuthenticatedUser(request));
    response.status(200).json({ data: { overview } });
  } catch (error) {
    next(error);
  }
});

export const studentDashboardRouter = Router();

studentDashboardRouter.use(authenticate, requireRole('STUDENT'));

studentDashboardRouter.get('/', async (request, response, next) => {
  try {
    const overview = await getStudentOverview(getAuthenticatedUser(request));
    response.status(200).json({ data: { overview } });
  } catch (error) {
    next(error);
  }
});
