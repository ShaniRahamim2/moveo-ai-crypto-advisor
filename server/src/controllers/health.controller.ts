import type { Request, Response } from 'express';
import { getHealth } from '../services/health.service.js';

export async function healthCheck(_req: Request, res: Response) {
  res.json(await getHealth());
}
