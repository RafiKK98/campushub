import { Router, type Request, type Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  courseIdParamSchema,
  courseListQuerySchema,
  createCourseSchema,
  updateCourseSchema,
  updateCourseStatusSchema,
  type CourseIdParams,
  type CourseListQuery,
  type CreateCourseInput,
  type UpdateCourseInput,
  type UpdateCourseStatusInput,
} from './course.schemas.js';
import {
  createCourse,
  deleteCourse,
  getCourseDetail,
  listCourses,
  listInstructorCourses,
  updateCourse,
  updateCourseStatus,
} from './course.service.js';
import {
  rosterQuerySchema,
  studentCourseListQuerySchema,
  type RosterQuery,
  type StudentCourseListQuery,
} from '../enrollments/enrollment.schemas.js';
import {
  dropCourse,
  enrollStudent,
  getRoster,
  listStudentCourses,
} from '../enrollments/enrollment.service.js';

const getValidatedParams = <T>(response: Response): T => {
  return response.locals.validatedParams as T;
};

const getValidatedQuery = <T>(response: Response): T => {
  return response.locals.validatedQuery as T;
};

const getAuthenticatedUser = (request: Request): AuthUser => {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  return request.user;
};

export const courseRouter = Router();

courseRouter.use(authenticate);

courseRouter.get('/', validateQuery(courseListQuerySchema), async (request, response, next) => {
  try {
    const query = getValidatedQuery<CourseListQuery>(response);
    const result = await listCourses(getAuthenticatedUser(request), query);
    response.status(200).json({ data: { courses: result.courses }, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

courseRouter.get('/:id', validateParams(courseIdParamSchema), async (request, response, next) => {
  try {
    const { id } = getValidatedParams<CourseIdParams>(response);
    const course = await getCourseDetail(getAuthenticatedUser(request), id);
    response.status(200).json({ data: { course } });
  } catch (error) {
    next(error);
  }
});

courseRouter.post(
  '/:id/enroll',
  requireRole('STUDENT'),
  validateParams(courseIdParamSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<CourseIdParams>(response);
      const studentId = getAuthenticatedUser(request).id;
      const enrollment = await enrollStudent(studentId, id);
      response.status(201).json({ data: { enrollment } });
    } catch (error) {
      next(error);
    }
  },
);

courseRouter.delete(
  '/:id/enroll',
  requireRole('STUDENT'),
  validateParams(courseIdParamSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<CourseIdParams>(response);
      const studentId = getAuthenticatedUser(request).id;
      await dropCourse(studentId, id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

export const adminCourseRouter = Router();

adminCourseRouter.use(authenticate, requireRole('ADMIN'));

adminCourseRouter.get(
  '/',
  validateQuery(courseListQuerySchema),
  async (request, response, next) => {
    try {
      const query = getValidatedQuery<CourseListQuery>(response);
      const result = await listCourses(getAuthenticatedUser(request), query);
      response.status(200).json({ data: { courses: result.courses }, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);

adminCourseRouter.post('/', validateBody(createCourseSchema), async (request, response, next) => {
  try {
    const course = await createCourse(request.body as CreateCourseInput);
    response.status(201).json({ data: { course } });
  } catch (error) {
    next(error);
  }
});

adminCourseRouter.patch(
  '/:id',
  validateParams(courseIdParamSchema),
  validateBody(updateCourseSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<CourseIdParams>(response);
      const course = await updateCourse(id, request.body as UpdateCourseInput);
      response.status(200).json({ data: { course } });
    } catch (error) {
      next(error);
    }
  },
);

adminCourseRouter.patch(
  '/:id/status',
  validateParams(courseIdParamSchema),
  validateBody(updateCourseStatusSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<CourseIdParams>(response);
      const course = await updateCourseStatus(id, request.body as UpdateCourseStatusInput);
      response.status(200).json({ data: { course } });
    } catch (error) {
      next(error);
    }
  },
);

adminCourseRouter.delete(
  '/:id',
  validateParams(courseIdParamSchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<CourseIdParams>(response);
      await deleteCourse(id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

adminCourseRouter.get(
  '/:id/roster',
  validateParams(courseIdParamSchema),
  validateQuery(rosterQuerySchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<CourseIdParams>(response);
      const query = getValidatedQuery<RosterQuery>(response);
      const result = await getRoster(getAuthenticatedUser(request), id, query);
      response.status(200).json({ data: { enrollments: result.enrollments }, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);

export const instructorCourseRouter = Router();

instructorCourseRouter.use(authenticate, requireRole('INSTRUCTOR'));

instructorCourseRouter.get(
  '/',
  validateQuery(courseListQuerySchema),
  async (request, response, next) => {
    try {
      const query = getValidatedQuery<CourseListQuery>(response);
      const result = await listInstructorCourses(getAuthenticatedUser(request), query);
      response.status(200).json({ data: { courses: result.courses }, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);

instructorCourseRouter.get(
  '/:id/roster',
  validateParams(courseIdParamSchema),
  validateQuery(rosterQuerySchema),
  async (request, response, next) => {
    try {
      const { id } = getValidatedParams<CourseIdParams>(response);
      const query = getValidatedQuery<RosterQuery>(response);
      const result = await getRoster(getAuthenticatedUser(request), id, query);
      response.status(200).json({ data: { enrollments: result.enrollments }, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);

export const studentCourseRouter = Router();

studentCourseRouter.use(authenticate, requireRole('STUDENT'));

studentCourseRouter.get(
  '/',
  validateQuery(studentCourseListQuerySchema),
  async (request, response, next) => {
    try {
      const query = getValidatedQuery<StudentCourseListQuery>(response);
      const result = await listStudentCourses(getAuthenticatedUser(request).id, query);
      response.status(200).json({ data: { courses: result.courses }, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);
