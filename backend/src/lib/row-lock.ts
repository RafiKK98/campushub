import type { Prisma } from '../generated/prisma/client.ts';

export const lockCourseRow = async (
  tx: Prisma.TransactionClient,
  courseId: string,
): Promise<void> => {
  await tx.$queryRaw`SELECT "id" FROM "Course" WHERE "id" = ${courseId}::uuid FOR UPDATE`;
};
