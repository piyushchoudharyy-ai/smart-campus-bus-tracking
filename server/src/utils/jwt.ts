import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { UserRole } from '../types.js';

export interface TokenPayload {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  driverId?: string;
  assignedBusId?: string | null;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch (error) {
    return null;
  }
}
