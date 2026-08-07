import { prisma } from '../lib/prisma.js';

export interface HealthReport {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
  database: 'ok' | 'unavailable';
}

// The database is reported but never gates the response: Render uses this path as
// its health check, and a transient database blip should not cycle the instance.
export async function getHealth(): Promise<HealthReport> {
  let database: HealthReport['database'] = 'unavailable';

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'ok';
  } catch {
    database = 'unavailable';
  }

  return {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database,
  };
}
