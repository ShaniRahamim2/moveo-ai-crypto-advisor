import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

// Replaces req.body with the parsed value so controllers receive normalized,
// typed input (trimmed strings, lowercased email) rather than raw JSON.
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}
