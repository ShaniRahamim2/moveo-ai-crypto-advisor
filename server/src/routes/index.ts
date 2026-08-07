import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller.js';
import { authRouter } from './auth.routes.js';
import { diagnosticsRouter } from './diagnostics.routes.js';
import { preferencesRouter } from './preferences.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', healthCheck);
apiRouter.use('/auth', authRouter);
apiRouter.use('/preferences', preferencesRouter);
apiRouter.use('/_diag', diagnosticsRouter);
