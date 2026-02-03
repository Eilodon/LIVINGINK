import WebSocket from 'ws';
import { LevelConfig, getLevelConfig, updateLevelConfig } from '@cjr/engine';

/**
 * Server-side Level Hot Reload
 * Connects to Config Server and updates in-memory level configs
 */
export class ServerLevelHotReload {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 5000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private serverUrl: string = 'ws://localhost:8091') {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        console.log('[ServerLevelHotReload] Connected to config server');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('[ServerLevelHotReload] Failed to parse message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('[ServerLevelHotReload] Disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('[ServerLevelHotReload] WebSocket error:', error);
      });
    } catch (error) {
      console.error('[ServerLevelHotReload] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectInterval);
  }

  private handleMessage(message: unknown): void {
    if (typeof message !== 'object' || message === null) return;
    const msg = message as { type: string; levelId?: number; level?: LevelConfig };

    if (msg.type === 'LEVEL_UPDATED' && msg.levelId && msg.level) {
      console.log(`[ServerLevelHotReload] Updating level ${msg.levelId}`);
      updateLevelConfig(msg.levelId, msg.level);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

let instance: ServerLevelHotReload | null = null;

export function getServerLevelHotReload(): ServerLevelHotReload {
  if (!instance) {
    instance = new ServerLevelHotReload();
  }
  return instance;
}

export function initServerLevelHotReload(): void {
  if (process.env.NODE_ENV === 'development') {
    getServerLevelHotReload().connect();
  }
}
