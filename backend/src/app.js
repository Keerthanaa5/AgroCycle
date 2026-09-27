import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './routes/userRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import buyerRoutes from './routes/buyerRoutes.js';
import silageRoutes from './routes/silageRoutes.js';
import carbonRoutes from './routes/carbonRoutes.js';
import claimRoutes from './routes/claimRoutes.js';
import agroconnectRoutes from './routes/agroconnectRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import syncRoutes from './routes/syncRoutes.js';
import logisticsRoutes from './routes/logisticsRoutes.js';

const app = express();

// 1. Security Headers via Helmet
app.use(helmet());

// 2. CORS configuration (no wildcard in production)
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl, health checks)
    if (!origin) return callback(null, true);

    if (config.isProduction) {
      if (config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    }

    // In development mode, allow configured origins or localhost variations
    if (
      config.corsOrigins.includes(origin) ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Idempotency-Key']
};
app.use(cors(corsOptions));

// 3. Request Logging
app.use(requestLogger);

// 4. Request Body Parsers with Size Limit Protection
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));

// 5. Mount API Routes under both /api and /api/v1 for universal client compatibility
const apiRouter = express.Router();
apiRouter.use(healthRoutes);
apiRouter.use(userRoutes);
apiRouter.use(locationRoutes);
apiRouter.use(assessmentRoutes);
apiRouter.use(marketplaceRoutes);
apiRouter.use(buyerRoutes);
apiRouter.use(silageRoutes);
apiRouter.use(carbonRoutes);
apiRouter.use(claimRoutes);
apiRouter.use(agroconnectRoutes);
apiRouter.use(notificationRoutes);
apiRouter.use(syncRoutes);
apiRouter.use(logisticsRoutes);

app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// 6. 404 Catch-All Handler
app.use(notFoundHandler);

// 7. Centralized Error Handler
app.use(errorHandler);

export default app;
