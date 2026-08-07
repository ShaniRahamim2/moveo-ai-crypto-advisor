import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller.js';
import { authRouter } from './auth.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', healthCheck);
apiRouter.use('/auth', authRouter);
