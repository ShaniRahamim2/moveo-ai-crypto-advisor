import type { NextFunction, Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { getUserId } from '../middleware/requireAuth.js';
import type { LoginInput, RegisterInput } from '../validation/auth.schema.js';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await authService.register(req.body as RegisterInput));
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await authService.login(req.body as LoginInput));
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ user: await authService.getUserById(getUserId(req)) });
  } catch (err) {
    next(err);
  }
}
