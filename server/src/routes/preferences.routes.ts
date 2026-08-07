import { Router } from 'express';
import * as preferencesController from '../controllers/preferences.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';
import { preferencesSchema } from '../validation/preferences.schema.js';

export const preferencesRouter = Router();

preferencesRouter.get('/options', requireAuth, preferencesController.getOptions);
preferencesRouter.get('/', requireAuth, preferencesController.getPreferences);
preferencesRouter.put(
  '/',
  requireAuth,
  validateBody(preferencesSchema),
  preferencesController.savePreferences,
);
