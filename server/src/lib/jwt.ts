import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './apiError.js';

export interface TokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || !decoded.sub) {
      throw new Error('Malformed token payload');
    }
    return { sub: decoded.sub };
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}
