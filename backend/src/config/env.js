import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const port = parseInt(process.env.PORT || '5000', 10);
const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

// Parse allowed CORS origins from comma-separated list or fallback to defaults
const corsOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const databaseUrl = process.env.DATABASE_URL || '';
const dbSsl = process.env.DB_SSL === 'true' || Boolean(databaseUrl && (databaseUrl.includes('neon.tech') || databaseUrl.includes('sslmode=require') || (!databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1'))));
const dbPoolMin = parseInt(process.env.DB_POOL_MIN || '2', 10);
const dbPoolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);


export const config = {
  port,
  nodeEnv,
  isProduction,
  frontendUrl,
  corsOrigins,
  bodyLimit: process.env.BODY_LIMIT || '10mb',
  databaseUrl,
  dbSsl,
  dbPoolMin,
  dbPoolMax,
};

