import { Router, type Request, type Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  submissionListQuerySchema,
  submitSubmissionSchema,
  type SubmissionListQuery,
  type SubmitSubmissionInput,
} from '../submissions/submission.schemas.js';
import {
  getOwnSubmission,
  listSubmissions,
  submitSubmission,
} from '../submissions/submission.service.js';
import {
  assignmentIdParamSchema,
  assignmentListQuerySchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  type AssignmentIdParams,
  type AssignmentListQuery,
  type CreateAssignmentInput,
  type UpdateAssignmentInput,
} from './assignment.schemas.js';
import {
  createAssignment,
  deleteAssignment,
  getAssignmentDetail,
  listAssignments,
  updateAssignment,
} from './assignment.service.js';

const getValidatedParams = <T>(response: Response): T => response.locals.validatedParams as T;
const getValidatedQuery = <T>(response: Response): T => response.locals.validatedQuery as T;
const getAuthenticatedUser = (request: Request): AuthUser => {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }
  return request.user;
};

export const assignmentRouter = Router();

assignmentRouter.use(authenticate);

// Shared listing with role-aware visibility
assignmentRouter.get(
  '/',
  validateQuery(assignmentListQuerySchema),
  async (request, response, next) => {
    try {
      const query = getValidatedQuery<AssignmentListQuery>(response);
      const result = await listAssignments(getAuthenticatedUser(request), query);
      response.status(200).json({ data: { assignments: result.assignments }, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);

// Shared assignment detail
assignmentRouter.get(
  '/:id',
  validateParams(assignmentIdParamSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<AssignmentIdParams>(response);
      const assignment = await getAssignmentDetail(getAuthenticatedUser(request), id);
      response.status(200).json({ data: { assignment } });
    } catch (error) {
      next(error);
    }
  },
);

// Student submit/resubmit assignment
assignmentRouter.post(
  '/:id/submit',
  requireRole('STUDENT'),
  validateParams(assignmentIdParamSchema),
  validateBody(submitSubmissionSchema),
  async (request, response, next) => {
    try {
      const { id: assignmentId } = getValidatedParams<AssignmentIdParams>(response);
      const studentId = getAuthenticatedUser(request).id;
      const submission = await submitSubmission(
        studentId,
        assignmentId,
        request.body as SubmitSubmissionInput,
      );
      response.status(201).json({ data: { submission } });
    } catch (error) {
      next(error);
    }
  },
);

// Student view own submission for assignment
assignmentRouter.get(
  '/:id/my-submission',
  requireRole('STUDENT'),
  validateParams(assignmentIdParamSchema),
  async (request, response, next) => {
    try {
      const { id: assignmentId } = getValidatedParams<AssignmentIdParams>(response);
      const studentId = getAuthenticatedUser(request).id;
      const submission = await getOwnSubmission(studentId, assignmentId);
      response.status(200).json({ data: { submission } });
    } catch (error) {
      next(error);
    }
  },
);

export const instructorAssignmentRouter = Router();

instructorAssignmentRouter.use(authenticate, requireRole('INSTRUCTOR'));

instructorAssignmentRouter.post(
  '/',
  validateBody(createAssignmentSchema),
  async (request, response, next) => {
    try {
      const assignment = await createAssignment(
        getAuthenticatedUser(request),
        request.body as CreateAssignmentInput,
      );
      response.status(201).json({ data: { assignment } });
    } catch (error) {
      next(error);
    }
  },
);

instructorAssignmentRouter.patch(
  '/:id',
  validateParams(assignmentIdParamSchema),
  validateBody(updateAssignmentSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<AssignmentIdParams>(response);
      const assignment = await updateAssignment(
        getAuthenticatedUser(request),
        id,
        request.body as UpdateAssignmentInput,
      );
      response.status(200).json({ data: { assignment } });
    } catch (error) {
      next(error);
    }
  },
);

instructorAssignmentRouter.delete(
  '/:id',
  validateParams(assignmentIdParamSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<AssignmentIdParams>(response);
      await deleteAssignment(getAuthenticatedUser(request), id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

// Instructor view submissions for an assignment
instructorAssignmentRouter.get(
  '/:id/submissions',
  validateParams(assignmentIdParamSchema),
  validateQuery(submissionListQuerySchema),
  async (request, response, next) => {
    try {
      const { id: assignmentId } = getValidatedParams<AssignmentIdParams>(response);
      const query = getValidatedQuery<SubmissionListQuery>(response);
      query.assignmentId = assignmentId;
      const result = await listSubmissions(getAuthenticatedUser(request), query);
      response.status(200).json({ data: { submissions: result.submissions }, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);

export const adminAssignmentRouter = Router();

adminAssignmentRouter.use(authenticate, requireRole('ADMIN'));

adminAssignmentRouter.post(
  '/',
  validateBody(createAssignmentSchema),
  async (request, response, next) => {
    try {
      const assignment = await createAssignment(
        getAuthenticatedUser(request),
        request.body as CreateAssignmentInput,
      );
      response.status(201).json({ data: { assignment } });
    } catch (error) {
      next(error);
    }
  },
);

adminAssignmentRouter.patch(
  '/:id',
  validateParams(assignmentIdParamSchema),
  validateBody(updateAssignmentSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<AssignmentIdParams>(response);
      const assignment = await updateAssignment(
        getAuthenticatedUser(request),
        id,
        request.body as UpdateAssignmentInput,
      );
      response.status(200).json({ data: { assignment } });
    } catch (error) {
      next(error);
    }
  },
);

adminAssignmentRouter.delete(
  '/:id',
  validateParams(assignmentIdParamSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<AssignmentIdParams>(response);
      await deleteAssignment(getAuthenticatedUser(request), id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

// Admin view submissions for any assignment
adminAssignmentRouter.get(
  '/:id/submissions',
  validateParams(assignmentIdParamSchema),
  validateQuery(submissionListQuerySchema),
  async (request, response, next) => {
    try {
      const { id: assignmentId } = getValidatedParams<AssignmentIdParams>(response);
      const query = getValidatedQuery<SubmissionListQuery>(response);
      query.assignmentId = assignmentId;
      const result = await listSubmissions(getAuthenticatedUser(request), query);
      response.status(200).json({ data: { submissions: result.submissions }, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);
