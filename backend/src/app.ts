import express, { type Request, type Response } from 'express';
import { prisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';

export const app = express();

app.disable('x-powered-by');
app.use(requestLogger);
app.use(express.json({ limit: '16kb' }));

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

app.use(notFoundHandler);
app.use(errorHandler);
