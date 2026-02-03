import * as WebSocket from 'ws';
import type { IncomingMessage } from 'http';

const PORT = 8093;
const wss = new (WebSocket as any).WebSocketServer({ port: PORT });

interface Packet {
  id: number;
  timestamp: number;
  direction: 'in' | 'out';
  type: number;
  size: number;
  data: number[];
}

let packetId = 0;
const packets: Packet[] = [];
const MAX_PACKETS = 10000;
const gameClients: Set<any> = new Set();
const uiClients: Set<any> = new Set();

console.log(`[PacketInspector] Server started on ws://localhost:${PORT}`);

function broadcastToUI(packet: Packet) {
  uiClients.forEach((client: any) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'PACKET', packet }));
    }
  });
}

wss.on('connection', (ws: any, req: IncomingMessage) => {
  const path = req.url || '';
  const clientType = path.startsWith('/game') ? 'game' : 'ui';

  if (clientType === 'game') {
    gameClients.add(ws);
    console.log(`[PacketInspector] Game client connected (${gameClients.size} total)`);
  } else {
    uiClients.add(ws);
    console.log(`[PacketInspector] UI client connected (${uiClients.size} total)`);

    // Send existing packets to new UI client
    packets.forEach(packet => {
      ws.send(JSON.stringify({ type: 'PACKET', packet }));
    });
  }

  ws.on('message', (data: any) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'PACKET' && clientType === 'game') {
        const packet: Packet = {
          id: ++packetId,
          timestamp: Date.now(),
          direction: message.direction || 'out',
          type: message.packetType || 0,
          size: message.data?.length || 0,
          data: message.data || []
        };

        packets.push(packet);
        if (packets.length > MAX_PACKETS) {
          packets.shift();
        }

        broadcastToUI(packet);
      }

      // Handle commands from UI
      if (clientType === 'ui' && message.type === 'COMMAND') {
        gameClients.forEach((client: any) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify(message));
          }
        });
      }
    } catch (err) {
      console.error('[PacketInspector] Parse error:', err);
    }
  });

  ws.on('close', () => {
    if (clientType === 'game') {
      gameClients.delete(ws);
      console.log(`[PacketInspector] Game client disconnected (${gameClients.size} remaining)`);
    } else {
      uiClients.delete(ws);
      console.log(`[PacketInspector] UI client disconnected (${uiClients.size} remaining)`);
    }
  });

  ws.on('error', (err: Error) => {
    console.error('[PacketInspector] WebSocket error:', err);
  });
});

console.log('[PacketInspector] Waiting for connections...');
