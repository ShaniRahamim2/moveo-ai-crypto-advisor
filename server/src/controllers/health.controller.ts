import type { Request, Response } from 'express';
import { getHealth } from '../services/health.service.js';

export async function healthCheck(req: Request, res: Response) {
  // TEMPORARY: confirms `trust proxy` resolves the real caller behind Render
  // rather than the proxy. Removed once verified against production.
  res.json({ ...(await getHealth()), clientIp: req.ip, forwardedFor: req.headers['x-forwarded-for'] });
}
