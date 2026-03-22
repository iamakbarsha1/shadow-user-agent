import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import type { ErrorResponse } from '../../types/api';
import {
  InvalidUrlError,
  UnknownPersonaError,
  RunNotFoundError,
  ReportNotFoundError,
  UnauthorizedError,
  RunLimitExceededError,
  AgentCrashError,
  AITimeoutError,
} from '../../utils/errors';
import { ValidationError } from '../validation';

/**
 * Global error handler middleware.
 * Converts errors to standardized API error responses.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  logger.error({ err, path: req.path, method: req.method }, 'Request error');

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';

  // Map custom errors to status codes
  if (err instanceof ValidationError) {
    statusCode = 400;
    code = err.code;
    message = err.message;
    const response: ErrorResponse = {
      error: {
        code,
        message,
        details: { errors: err.errors },
      },
    };
    res.status(statusCode).json(response);
    return;
  } else if (err instanceof InvalidUrlError) {
    statusCode = 400;
    code = err.code;
    message = err.message;
  } else if (err instanceof UnknownPersonaError) {
    statusCode = 400;
    code = err.code;
    message = err.message;
  } else if (err instanceof UnauthorizedError) {
    statusCode = 401;
    code = err.code;
    message = err.message;
  } else if (err instanceof RunNotFoundError || err instanceof ReportNotFoundError) {
    statusCode = 404;
    code = err.code;
    message = err.message;
  } else if (err instanceof RunLimitExceededError) {
    statusCode = 429;
    code = err.code;
    message = err.message;
  } else if (err instanceof AgentCrashError) {
    statusCode = 500;
    code = err.code;
    message = err.message;
  } else if (err instanceof AITimeoutError) {
    statusCode = 504;
    code = err.code;
    message = err.message;
  }

  const response: ErrorResponse = {
    error: {
      code,
      message,
      details: {},
    },
  };

  res.status(statusCode).json(response);
}
