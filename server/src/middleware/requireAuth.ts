import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/apiError.js';
import { verifyToken } from '../lib/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(ApiError.unauthorized('Authentication required'));
    return;
  }

  try {
    req.userId = verifyToken(header.slice('Bearer '.length).trim()).sub;
    next();
  } catch (err) {
    next(err);
  }
}

// Controllers behind requireAuth always have a userId; this keeps that
// assumption in one place instead of a non-null assertion at every call site.
export function getUserId(req: Request): string {
  if (!req.userId) {
    throw ApiError.unauthorized('Authentication required');
  }
  return req.userId;
}
