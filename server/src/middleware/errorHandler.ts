import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/apiError.js';
import { isProduction } from '../config/env.js';

function isClientError(err: unknown): err is { status: number } {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route matches ${req.method} ${req.path}` },
  });
}

// Stack traces never leave the process. Unexpected errors are logged server-side
// and reported to the client as an opaque 500.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  // Body-parser reports malformed JSON and an oversize payload by setting
  // `status` on the error. Without this they fall through as 500s, which blames
  // the server for a fault in the request and makes the logs read wrong during
  // an incident. The message is body-parser's own and describes the request
  // only — it carries no internal detail.
  if (isClientError(err)) {
    res.status(err.status).json({
      error: {
        code: err.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        message: err.status === 413 ? 'Request body is too large' : 'Request body is not valid JSON',
      },
    });
    return;
  }

  if (!isProduction) {
    console.error(err);
  } else {
    console.error(err instanceof Error ? err.message : 'Unknown error');
  }

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
