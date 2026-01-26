/**
 * COLOR JELLY RUSH MULTIPLAYER SERVER - ENTRY POINT
 *
 * Production-ready Colyseus server with:
 * - Express integration for health checks
 * - CORS configuration
 * - Graceful shutdown
 */

import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express, { Request } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { GameRoom } from './rooms/GameRoom.js';
import authRoutes from './auth/authRoutes.js';
import { authMiddleware, optionalAuthMiddleware } from './auth/AuthService.js';
import monitoringRoutes from './monitoring/monitoringRoutes.js';
import { monitoringService } from './monitoring/MonitoringService.js';
import { logger, errorHandler } from './logging/Logger.js';

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
  
  logger.info('🚀 PHASE1: Starting CJR Server...', {
    nodeVersion: process.version,
    platform: process.platform,
    port: PORT,
    host: HOST
  });
  
  const app = express();

  // EIDOLON-V PHASE1: Secure CORS configuration
  const allowedOrigins = process.env.CORS_ORIGIN ? 
    process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
    ['http://localhost:5173', 'http://localhost:3000']; // Dev fallback
  
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // 24 hours
  }));
  app.use(express.json({ limit: '10mb' })); // EIDOLON-V PHASE1: Limit payload size
  
  // EIDOLON-V PHASE1: Rate limiting middleware
  const rateLimit = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const RATE_LIMIT_MAX = 100; // requests per minute
  
  app.use((req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const client = rateLimit.get(clientIp);
    
    if (!client || now > client.resetTime) {
      rateLimit.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return next();
    }
    
    if (client.count >= RATE_LIMIT_MAX) {
      return res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: Math.ceil((client.resetTime - now) / 1000)
      });
    }
    
    client.count++;
    next();
  });

  // EIDOLON-V PHASE1: Enhanced health check with security metrics
  app.get('/health', (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const rateLimitInfo = rateLimit.get(clientIp);
    
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
      security: {
        rateLimitActive: rateLimitInfo ? rateLimitInfo.count : 0,
        rateLimitMax: RATE_LIMIT_MAX,
        corsEnabled: true,
        allowedOrigins: allowedOrigins.length
      },
      version: '1.0.0-phase1'
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
      user: req.user
    });
  });

  const httpServer = createServer(app);

  // Create Colyseus server
  const gameServer = new Server({
    transport: new WebSocketTransport({
      server: httpServer,
      pingInterval: 3000,
      pingMaxRetries: 3,
    }),
  });

  // Register room handlers
  gameServer.define('game', GameRoom)
    .sortBy({ clients: -1 }) // Matchmaking: fill rooms with more players first
    .filterBy(['mode']); // Allow filtering by game mode

  // Start listening
  await gameServer.listen(PORT);

  console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║                                                   ║
  ║   🎨 COLOR JELLY RUSH SERVER v1.0.0              ║
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
        userAgent: req.get('User-Agent')
      });
    });
    
    next();
  });
  
  // EIDOLON-V PHASE1: Start metrics collection
  console.log('📊 PHASE1: Starting monitoring service...');
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

main().catch((error) => {
  logger.error('💥 PHASE1: Failed to start server', { port: PORT }, error);
  process.exit(1);
});
