import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller.js';
import { authRouter } from './auth.routes.js';
import { preferencesRouter } from './preferences.routes.js';
import { feedbackRouter } from './feedback.routes.js';
import { getDashboard, getPrices } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { dashboardLimiter } from '../middleware/rateLimit.js';

export const apiRouter = Router();

apiRouter.get('/health', healthCheck);
apiRouter.get('/dashboard', dashboardLimiter, requireAuth, getDashboard);
apiRouter.get('/dashboard/prices', dashboardLimiter, requireAuth, getPrices);
apiRouter.use('/auth', authRouter);
apiRouter.use('/preferences', preferencesRouter);
apiRouter.use('/feedback', feedbackRouter);
