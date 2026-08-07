import type { NextFunction, Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { getUserId } from '../middleware/requireAuth.js';

const dashboardService = new DashboardService();

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const previousMeme = typeof req.query.previousMeme === 'string' ? req.query.previousMeme : undefined;
    res.json(await dashboardService.build(getUserId(req), previousMeme));
  } catch (err) {
    next(err);
  }
}
