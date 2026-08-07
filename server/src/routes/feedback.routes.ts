import { Router } from 'express';
import * as feedbackController from '../controllers/feedback.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';
import { feedbackSchema } from '../validation/feedback.schema.js';

export const feedbackRouter = Router();

feedbackRouter.get('/', requireAuth, feedbackController.getVotes);
feedbackRouter.post('/', requireAuth, validateBody(feedbackSchema), feedbackController.submitVote);
