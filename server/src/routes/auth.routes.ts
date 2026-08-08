import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validation/auth.schema.js';
import { authLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerSchema), authController.register);
authRouter.post('/login', authLimiter, validateBody(loginSchema), authController.login);
authRouter.get('/me', requireAuth, authController.me);
