import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { createLoginRateLimiter } from '../../middleware/rateLimiter.js';
import { loginSchema } from './auth.schemas.js';
import { authenticateCredentials, logout } from './auth.service.js';

const router = Router();

const loginRateLimiter = createLoginRateLimiter();

router.post(
  '/login',
  loginRateLimiter,
  validateBody(loginSchema),
  async (request, response, next) => {
    try {
      const user = await authenticateCredentials(request.body, response);
      response.status(200).json({ data: { user } });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/logout', async (_request, response, next) => {
  try {
    logout(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, (request, response) => {
  response.status(200).json({ data: { user: request.user } });
});

export const authRouter = router;
