import express, { type NextFunction, type Request, type Response } from 'express';

export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_request: Request, response: Response) => {
  response.status(200).json({
    data: {
      status: 'ok',
      service: 'campushub-api',
    },
  });
});

app.use((_request: Request, response: Response) => {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found.',
    },
  });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error(error);
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
});
