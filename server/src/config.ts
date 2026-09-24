import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root or server dir
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseCorsOrigins(originEnv?: string): string[] | string {
  if (!originEnv || originEnv.trim() === '*' || originEnv.trim() === '') {
    return '*';
  }
  return originEnv.split(',').map((o) => o.trim()).filter(Boolean);
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'campus_bus_production_jwt_secret_key_2026',
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),
  dbPath: process.env.DB_PATH || path.resolve(process.cwd(), 'campus_bus.db'),
  isDev: process.env.NODE_ENV !== 'production'
};
