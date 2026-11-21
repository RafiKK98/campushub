import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger } from '../lib/logger.js';

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();
  const requestId = randomUUID();

  response.locals.requestId = requestId;
  response.setHeader('x-request-id', requestId);

  response.on('finish', () => {
    logger.info('request.completed', {
      requestId,
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });

  next();
};
