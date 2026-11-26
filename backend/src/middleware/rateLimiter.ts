import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

export interface LoginRateLimiterOptions {
  limit?: number;
  windowMs?: number;
}

export const createLoginRateLimiter = (options: LoginRateLimiterOptions = {}) => {
  return rateLimit({
    windowMs: options.windowMs ?? env.LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: options.limit ?? env.LOGIN_RATE_LIMIT_MAX,
    standardHeaders: false,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (request) => ipKeyGenerator(request.ip ?? ''),
    handler: (_request, _response, _next) => {
      throw new AppError(429, 'TOO_MANY_REQUESTS', 'Too many login attempts. Try again later.');
    },
  });
};

export const createRegistrationRateLimiter = (options: LoginRateLimiterOptions = {}) => {
  return rateLimit({
    windowMs: options.windowMs ?? env.REGISTRATION_RATE_LIMIT_WINDOW_MS,
    limit: options.limit ?? env.REGISTRATION_RATE_LIMIT_MAX,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (request) => ipKeyGenerator(request.ip ?? ''),
    handler: (_request, _response, _next) => {
      throw new AppError(
        429,
        'TOO_MANY_REQUESTS',
        'Too many registration attempts. Try again later.',
      );
    },
  });
};
