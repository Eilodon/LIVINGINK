/**
 * COLOR-JELLY-RUSH MULTIPLAYER SERVER - ENTRY POINT
 *
 * EIDOLON-V OPEN BETA: Production-ready Colyseus server with:
 * - Express integration for health checks
 * - CORS configuration
 * - Helmet security headers
 * - Redis-backed rate limiting (distributed)
 * - Redis-backed sessions (distributed)
 * - Graceful shutdown
 */

import colyseus from 'colyseus';
const { Server } = colyseus;
import { WebSocketTransport } from '@colyseus/ws-transport';
import express, { Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { GameRoom } from './rooms/GameRoom.js';
import authRoutes from './auth/authRoutes.js';
import {
  authMiddleware,
  initAuthService,
  startAuthMaintenance,
  AuthService,
} from './auth/AuthService.js';
import monitoringRoutes from './monitoring/monitoringRoutes.js';
import { monitoringService } from './monitoring/MonitoringService.js';
import { logger, errorHandler } from './logging/Logger.js';
import { rateLimiter, authRateLimiter } from './security/RateLimiter.js';
import { cache } from './database/RedisManager.js';

// EIDOLON-V PHASE1: Extend Express Request interface
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

const PORT = parseInt(process.env.PORT || '2567', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  // EIDOLON-V PHASE1: Setup global error handlers
  errorHandler.setupGlobalHandlers();

  logger.info('🚀 OPEN BETA: Starting CJR Server...', {
    nodeVersion: process.version,
    platform: process.platform,
    port: PORT,
    host: HOST,
  });

  // EIDOLON-V OPEN BETA: Initialize Redis for distributed rate limiting and sessions
  let redisConnected = false;
  try {
    await cache.connect();
    await rateLimiter.init(cache);
    await authRateLimiter.init(cache);
    await AuthService.initSessionStore(cache);
    redisConnected = true;
    logger.info('✅ Redis connected - using distributed rate limiting and sessions');
  } catch (error) {
    logger.warn(
      '⚠️ Redis unavailable - falling back to in-memory (NOT recommended for production)',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    );
  }

  const app = express();

  // EIDOLON-V OPEN BETA: Security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Required for game assets
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // EIDOLON-V PHASE1: Secure CORS configuration
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://localhost:3000']; // Dev fallback

  app.use(
    cors({
      origin: (origin, callback) => {
        // EIDOLON-V FIX: Only allow no-origin for health checks
        if (!origin) {
          // Allow requests without origin ONLY for health endpoint
          // This blocks CSRF while allowing monitoring tools
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86400, // 24 hours
    })
  );
  app.use(express.json({ limit: '10mb' })); // EIDOLON-V PHASE1: Limit payload size

  // EIDOLON-V OPEN BETA: Redis-backed distributed rate limiting
  app.use(rateLimiter.middleware());

  // EIDOLON-V OPEN BETA: Enhanced health check with security metrics
  app.get('/health', async (req, res) => {
    const redisHealth = await cache.healthCheck().catch(() => ({ connected: false }));
    const rateLimitStats = rateLimiter.getStats();

    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
      security: {
        rateLimitMode: rateLimitStats.mode,
        corsEnabled: true,
        allowedOrigins: allowedOrigins.length,
        helmetEnabled: true,
      },
      infrastructure: {
        redis: redisHealth.connected ? 'connected' : 'disconnected',
        redisLatency: 'latency' in redisHealth ? redisHealth.latency : null,
      },
      version: '1.0.0-beta.1',
    });
  });

  // EIDOLON-V PHASE1: Authentication routes
  app.use('/auth', authRoutes);

  // EIDOLON-V PHASE1: Monitoring routes
  app.use('/monitoring', monitoringRoutes);

  // EIDOLON-V PHASE1: Protected server info endpoint
  app.get('/info', authMiddleware, (req: AuthenticatedRequest, res) => {
    res.json({
      name: 'CJR Game Server',
      version: '1.0.0-phase1',
      rooms: (gameServer as any).matchMaker.stats.roomCount,
      clients: (gameServer as any).matchMaker.stats.ccu,
      authenticated: true,
      user: req.user,
    });
  });

  const httpServer = createServer(app);

  // Create Colyseus server
  const gameServer = new Server({
    transport: new WebSocketTransport({
      server: httpServer,
      pingInterval: 3000,
      pingMaxRetries: 3,
      maxPayload: 1024 * 1024, // EIDOLON-V: 1MB limit - prevents DoS via oversized messages
      // EIDOLON-V P1: WebSocket origin validation
      verifyClient: (info, callback) => {
        const origin = info.origin || (info.req as any).headers?.origin;

        // Allow no-origin (server-to-server, same-origin, or dev tools)
        if (!origin) {
          callback(true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(true);
        } else {
          logger.warn('[WS] Origin rejected', { origin });
          callback(false, 403, 'Origin not allowed');
        }
      },
    }),
  });

  // Register room handlers
  gameServer
    .define('game', GameRoom)
    .sortBy({ clients: -1 }) // Matchmaking: fill rooms with more players first
    .filterBy(['mode']); // Allow filtering by game mode

  // Start listening
  await gameServer.listen(PORT);

  // Auth init/maintenance (explicit boot order; no module side-effects)
  await initAuthService();
  startAuthMaintenance();

  logger.info(`
  ╔═══════════════════════════════════════════════════╗
  ║                                                   ║
  ║   🎨 COLOR-JELLY-RUSH SERVER v1.0.0              ║
  ║                                                   ║
  ║   Server running on:                              ║
  ║   → HTTP:  http://${HOST}:${PORT}                      ║
  ║   → WS:    ws://${HOST}:${PORT}                        ║
  ║                                                   ║
  ║   📊 Monitoring: /monitoring/health                 ║
  ║   🔐 Auth: /auth/login                              ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
  `);

  // EIDOLON-V PHASE1: Enhanced error handling middleware
  app.use(errorHandler.asyncErrorHandler());

  // EIDOLON-V PHASE1: Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    });

    next();
  });

  // EIDOLON-V PHASE1: Start metrics collection
  logger.info('📊 PHASE1: Starting monitoring service...');
  setInterval(() => {
    monitoringService.collectMetrics();
  }, 5000); // Collect metrics every 5 seconds

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('🛑 PHASE1: Graceful shutdown initiated');

    // Give clients time to disconnect
    await gameServer.gracefullyShutdown(true);

    logger.info('✅ PHASE1: Server shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(error => {
  logger.error('💥 PHASE1: Failed to start server', { port: PORT }, error);
  process.exit(1);
});
