import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller.js';

export const apiRouter = Router();

apiRouter.get('/health', healthCheck);
