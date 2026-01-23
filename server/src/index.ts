/**
 * GU-KING MULTIPLAYER SERVER - ENTRY POINT
 *
 * Production-ready Colyseus server with:
 * - Express integration for health checks
 * - CORS configuration
 * - Graceful shutdown
 */

import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { GameRoom } from './rooms/GameRoom.js';

const PORT = parseInt(process.env.PORT || '2567', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  });

  // Server info endpoint
  app.get('/info', (req, res) => {
    res.json({
      name: 'Gu-King Game Server',
      version: '1.0.0',
      rooms: gameServer.matchMaker.stats.roomCount,
      clients: gameServer.matchMaker.stats.ccu,
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
  ║   🐍 GU-KING GAME SERVER v1.0.0                  ║
  ║                                                   ║
  ║   Server running on:                              ║
  ║   → HTTP:  http://${HOST}:${PORT}                      ║
  ║   → WS:    ws://${HOST}:${PORT}                        ║
  ║                                                   ║
  ║   Endpoints:                                      ║
  ║   → /health  - Health check                       ║
  ║   → /info    - Server info                        ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
  `);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\\nShutting down gracefully...');

    // Give clients time to disconnect
    await gameServer.gracefullyShutdown(true);

    console.log('Server shut down complete.');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
