import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

const keyGenerator = (request: Express.Request): string => {
  return request.ip ?? 'unknown';
};

export const createLoginRateLimiter = () => {
  return rateLimit({
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: env.LOGIN_RATE_LIMIT_MAX,
    standardHeaders: false,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator,
    handler: (_request, _response, _next) => {
      throw new AppError(429, 'TOO_MANY_REQUESTS', 'Too many login attempts. Try again later.');
    },
  });
};
