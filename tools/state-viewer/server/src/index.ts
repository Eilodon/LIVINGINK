import express from 'express';
import * as WebSocket from 'ws';
import type { IncomingMessage } from 'http';

const app = express();
const PORT = 8092;

interface GameSnapshot {
  frame: number;
  timestamp: number;
  entities: unknown[];
  gameState: {
    gameTime: number;
    bossActive: boolean;
    rushWindowActive: boolean;
    playerCount: number;
    entityCount: number;
  };
}

const wss = new (WebSocket as any).WebSocketServer({ port: PORT });

let latestSnapshot: GameSnapshot | null = null;
let gameClient: any = null;
const uiClients: Set<any> = new Set();

console.log(`[StateViewer] Server started on ws://localhost:${PORT}`);

wss.on('connection', (ws: any, req: IncomingMessage) => {
  const clientType = req.url === '/game' ? 'game' : 'ui';
  
  if (clientType === 'game') {
    gameClient = ws;
    console.log('[StateViewer] Game client connected');
  } else {
    uiClients.add(ws);
    console.log(`[StateViewer] UI client connected (${uiClients.size} total)`);
    
    // Send latest snapshot to new UI client
    if (latestSnapshot) {
      ws.send(JSON.stringify({ type: 'SNAPSHOT', snapshot: latestSnapshot }));
    }
  }

  ws.on('message', (data: any) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'SNAPSHOT' && clientType === 'game') {
        latestSnapshot = message.snapshot;
        
        // Broadcast to all UI clients
        uiClients.forEach((client: any) => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify({ type: 'SNAPSHOT', snapshot: latestSnapshot }));
          }
        });
      }
      
      // Handle control commands from UI
      if (clientType === 'ui' && message.type === 'COMMAND') {
        // Forward to game client
        if (gameClient?.readyState === 1) {
          gameClient.send(JSON.stringify(message));
        }
      }
    } catch (err) {
      console.error('[StateViewer] Parse error:', err);
    }
  });

  ws.on('close', () => {
    if (clientType === 'game') {
      gameClient = null;
      console.log('[StateViewer] Game client disconnected');
    } else {
      uiClients.delete(ws);
      console.log(`[StateViewer] UI client disconnected (${uiClients.size} remaining)`);
    }
  });

  ws.on('error', (err: Error) => {
    console.error('[StateViewer] WebSocket error:', err);
  });
});

console.log('[StateViewer] Waiting for connections...');
