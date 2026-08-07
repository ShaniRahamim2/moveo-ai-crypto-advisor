import type { NextFunction, Request, Response } from 'express';
import * as feedbackService from '../services/feedback.service.js';
import { getPreferences } from '../services/preferences.service.js';
import { getUserId } from '../middleware/requireAuth.js';
import type { FeedbackInput } from '../validation/feedback.schema.js';

export async function submitVote(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const input = req.body as FeedbackInput;

    // Snapshotted server-side rather than trusted from the client.
    const preferences = await getPreferences(userId);
    const context = preferences
      ? {
          selectedAssets: preferences.selectedAssets,
          investorType: preferences.investorType,
          contentPreferences: preferences.contentPreferences,
        }
      : undefined;

    res.json({ feedback: await feedbackService.submitVote(userId, input, context) });
  } catch (err) {
    next(err);
  }
}

export async function getVotes(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ feedback: await feedbackService.getVotes(getUserId(req)) });
  } catch (err) {
    next(err);
  }
}
