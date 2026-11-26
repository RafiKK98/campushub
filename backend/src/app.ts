import express, { type Request, type Response } from 'express';
// import helmet from 'helmet';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { originGuard } from './middleware/originGuard.js';
import { requestLogger } from './middleware/request-logger.js';
import { announcementRouter } from './modules/announcements/announcement.routes.js';
import {
  adminAssignmentRouter,
  assignmentRouter,
  instructorAssignmentRouter,
} from './modules/assignments/assignment.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import {
  adminCourseRouter,
  courseRouter,
  instructorCourseRouter,
  studentCourseRouter,
} from './modules/courses/course.routes.js';
import {
  adminDashboardRouter,
  instructorDashboardRouter,
  studentDashboardRouter,
} from './modules/dashboards/dashboard.routes.js';
import {
  adminSubmissionRouter,
  instructorSubmissionRouter,
  studentSubmissionRouter,
} from './modules/submissions/submission.routes.js';
import { adminUserRouter } from './modules/users/user.routes.js';

export const app = express();

app.disable('x-powered-by');

if (env.TRUST_PROXY) {
  app.set('trust proxy', env.TRUST_PROXY);
}

// app.use(helmet());
app.use(requestLogger);
app.use(express.json({ limit: '16kb' }));
app.use(originGuard);

app.get('/api/health', (_request: Request, response: Response) => {
  response.status(200).json({
    data: {
      status: 'ok',
      service: 'campushub-api',
    },
  });
});

app.get('/api/ready', async (_request: Request, response: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    response.status(200).json({
      data: {
        status: 'ready',
        database: 'ok',
      },
    });
  } catch (error) {
    logger.warn('readiness.failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    response.status(503).json({
      error: {
        code: 'NOT_READY',
        message: 'Database is unavailable.',
      },
    });
  }
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/courses', courseRouter);
app.use('/api/v1/admin/courses', adminCourseRouter);
app.use('/api/v1/instructor/courses', instructorCourseRouter);
app.use('/api/v1/student/courses', studentCourseRouter);

app.use('/api/v1/assignments', assignmentRouter);
app.use('/api/v1/admin/assignments', adminAssignmentRouter);
app.use('/api/v1/instructor/assignments', instructorAssignmentRouter);

app.use('/api/v1/student/submissions', studentSubmissionRouter);
app.use('/api/v1/instructor/submissions', instructorSubmissionRouter);
app.use('/api/v1/admin/submissions', adminSubmissionRouter);

app.use('/api/v1/announcements', announcementRouter);

app.use('/api/v1/admin/users', adminUserRouter);

app.use('/api/v1/admin/overview', adminDashboardRouter);
app.use('/api/v1/instructor/overview', instructorDashboardRouter);
app.use('/api/v1/student/overview', studentDashboardRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
