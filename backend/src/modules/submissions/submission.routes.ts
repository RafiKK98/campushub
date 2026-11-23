import { Router, type Request, type Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  gradeSubmissionSchema,
  submissionIdParamSchema,
  submissionListQuerySchema,
  type GradeSubmissionInput,
  type SubmissionIdParams,
  type SubmissionListQuery,
} from './submission.schemas.js';
import { gradeSubmission, listSubmissions } from './submission.service.js';

const getValidatedParams = <T>(response: Response): T => response.locals.validatedParams as T;
const getValidatedQuery = <T>(response: Response): T => response.locals.validatedQuery as T;
const getAuthenticatedUser = (request: Request): AuthUser => {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }
  return request.user;
};

export const studentSubmissionRouter = Router();

studentSubmissionRouter.use(authenticate, requireRole('STUDENT'));

// Student lists all their own submissions across courses
studentSubmissionRouter.get(
  '/',
  validateQuery(submissionListQuerySchema),
  async (request, response, next) => {
    try {
      const query = getValidatedQuery<SubmissionListQuery>(response);
      const result = await listSubmissions(getAuthenticatedUser(request), query);
      response.status(200).json({ data: { submissions: result.submissions }, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);

export const instructorSubmissionRouter = Router();

instructorSubmissionRouter.use(authenticate, requireRole('INSTRUCTOR'));

// Instructor grades a submission for an assignment in their own course
instructorSubmissionRouter.patch(
  '/:id/grade',
  validateParams(submissionIdParamSchema),
  validateBody(gradeSubmissionSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<SubmissionIdParams>(response);
      const submission = await gradeSubmission(
        getAuthenticatedUser(request),
        id,
        request.body as GradeSubmissionInput,
      );
      response.status(200).json({ data: { submission } });
    } catch (error) {
      next(error);
    }
  },
);

export const adminSubmissionRouter = Router();

adminSubmissionRouter.use(authenticate, requireRole('ADMIN'));

// Admin grades any submission
adminSubmissionRouter.patch(
  '/:id/grade',
  validateParams(submissionIdParamSchema),
  validateBody(gradeSubmissionSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<SubmissionIdParams>(response);
      const submission = await gradeSubmission(
        getAuthenticatedUser(request),
        id,
        request.body as GradeSubmissionInput,
      );
      response.status(200).json({ data: { submission } });
    } catch (error) {
      next(error);
    }
  },
);
