import type { RequestHandler } from 'express';
import type { ZodError, ZodType } from 'zod';
import { AppError, type ErrorDetails } from '../errors/app-error.js';

const toDetails = (error: ZodError): ErrorDetails =>
  error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
    code: issue.code,
  }));

const validationError = (error: ZodError): AppError =>
  new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', toDetails(error));

export const validateBody = <T>(schema: ZodType<T>): RequestHandler => {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(validationError(result.error));
      return;
    }

    request.body = result.data;
    next();
  };
};

export const validateParams = <T>(schema: ZodType<T>): RequestHandler => {
  return (request, response, next) => {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      next(validationError(result.error));
      return;
    }

    response.locals.validatedParams = result.data;
    next();
  };
};

export const validateQuery = <T>(schema: ZodType<T>): RequestHandler => {
  return (request, response, next) => {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      next(validationError(result.error));
      return;
    }

    response.locals.validatedQuery = result.data;
    next();
  };
};
