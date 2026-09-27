import app from './app.js';
import { config } from './config/env.js';
import { closePool } from './db/pool.js';

const PORT = config.port;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AgroCycle Backend] Server running in ${config.nodeEnv} mode on port ${PORT}`);
  console.log(`[AgroCycle Backend] Health endpoint: http://localhost:${PORT}/api/v1/health`);
  console.log(`[AgroCycle Backend] DB Health endpoint: http://localhost:${PORT}/api/v1/health/db`);
});

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\n[AgroCycle Backend] Received ${signal}. Shutting down gracefully...`);
  
  // Close DB pool connections
  await closePool();

  server.close(() => {
    console.log('[AgroCycle Backend] HTTP server closed.');
    process.exit(0);
  });

  // Force shutdown after 10s if connections remain open
  setTimeout(() => {
    console.error('[AgroCycle Backend] Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
