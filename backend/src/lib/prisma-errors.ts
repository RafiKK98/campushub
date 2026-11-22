export const hasPrismaErrorCode = (error: unknown, code: string): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
};
