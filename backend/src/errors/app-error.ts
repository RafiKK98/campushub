export type ErrorDetails = Array<{
  path: string;
  message: string;
  code: string;
}>;

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetails;

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
