import type { Request, Response } from 'express';
import { getHealth } from '../services/health.service.js';

export async function healthCheck(req: Request, res: Response) {
  // TEMPORARY: confirms `trust proxy` resolves the real caller behind Render
  // rather than the proxy. Removed once verified against production.
  res.json({
    ...(await getHealth()),
    clientIp: req.ip,
    ips: req.ips,
    forwardedFor: req.headers['x-forwarded-for'],
    cfConnectingIp: req.headers['cf-connecting-ip'],
    trueClientIp: req.headers['true-client-ip'],
    xRealIp: req.headers['x-real-ip'],
  });
}
