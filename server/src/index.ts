import express from 'express';
import http from 'http';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDatabase } from './db/index.js';
import { initSocketIO } from './services/socketService.js';
import { errorHandler } from './middleware/error.js';

// Import Routes
import authRouter from './routes/auth.js';
import busesRouter from './routes/buses.js';
import driversRouter from './routes/drivers.js';
import routesRouter from './routes/routes.js';
import stopsRouter from './routes/stops.js';
import tripsRouter from './routes/trips.js';
import locationRouter from './routes/location.js';
import emergencyRouter from './routes/emergency.js';
import occupancyRouter from './routes/occupancy.js';
import notificationsRouter from './routes/notifications.js';
import analyticsRouter from './routes/analytics.js';
import simulationRouter from './routes/simulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
initDatabase();

const app = express();
const server = http.createServer(app);

// Enable trust proxy for platforms like Render, Railway, Fly.io, Heroku, Nginx
app.set('trust proxy', 1);

// Initialize Socket.io with dynamic production CORS
initSocketIO(server, config.corsOrigin);

// Global Middleware
app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Smart Campus Bus Tracking API',
    environment: config.isDev ? 'development' : 'production'
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/buses', busesRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/routes', routesRouter);
app.use('/api/stops', stopsRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/location', locationRouter);
app.use('/api/emergency', emergencyRouter);
app.use('/api/occupancy', occupancyRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/simulation', simulationRouter);

// Serve Static Frontend if built in production (supports single-container / unified deployment)
const candidateStaticPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), 'dist/public')
];

for (const staticPath of candidateStaticPaths) {
  if (fs.existsSync(staticPath)) {
    console.log(`Serving static client assets from: ${staticPath}`);
    app.use(express.static(staticPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.resolve(staticPath, 'index.html'));
    });
    break;
  }
}

// Global Error Handler
app.use(errorHandler);

// Start Server on 0.0.0.0 and process.env.PORT
server.listen(config.port, config.host, () => {
  console.log(`===============================================`);
  console.log(`🚌 Campus Bus Tracking Server running!`);
  console.log(`📡 Host: ${config.host} | Port: ${config.port}`);
  console.log(`📡 HTTP API: http://${config.host}:${config.port}/api`);
  console.log(`⚡ WebSocket gateway online on port ${config.port}`);
  console.log(`===============================================`);
});

export { app, server };
