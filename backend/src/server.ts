import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info('server.started', {
    host: env.HOST,
    port: env.PORT,
    environment: env.NODE_ENV,
  });
});

let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('server.shutdown.started', { signal });

  server.close(async (error) => {
    if (error) {
      logger.error('server.shutdown.failed', {
        signal,
        errorName: error.name,
        errorMessage: error.message,
      });
      await prisma.$disconnect();
      process.exit(1);
    }

    await prisma.$disconnect();
    logger.info('server.shutdown.completed', { signal });
    process.exit(0);
  });
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
