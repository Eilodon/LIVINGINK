import { LevelConfig } from '@cjr/engine';

/**
 * Level Hot Reload Service
 * Connects to the Config Server WebSocket and updates level configs in real-time
 */
export class LevelHotReload {
  private ws: WebSocket | null = null;
  private levelConfigs: Map<number, LevelConfig> = new Map();
  private listeners: Set<(levelId: number, config: LevelConfig) => void> = new Set();
  private reconnectInterval: number = 5000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private serverUrl: string = 'ws://localhost:8091') {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[LevelHotReload] Already connected');
      return;
    }

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('[LevelHotReload] Connected to config server');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[LevelHotReload] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[LevelHotReload] Disconnected from config server');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[LevelHotReload] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[LevelHotReload] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    console.log(`[LevelHotReload] Reconnecting in ${this.reconnectInterval}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectInterval);
  }

  private handleMessage(message: unknown): void {
    if (typeof message !== 'object' || message === null) return;

    const msg = message as { type: string; levelId?: number; level?: LevelConfig; levels?: LevelConfig[] };

    switch (msg.type) {
      case 'INITIAL_STATE':
        if (msg.levels) {
          msg.levels.forEach(level => {
            this.levelConfigs.set(level.id, level);
          });
          console.log(`[LevelHotReload] Loaded ${msg.levels.length} levels`);
        }
        break;

      case 'LEVEL_UPDATED':
        if (msg.levelId && msg.level) {
          console.log(`[LevelHotReload] Level ${msg.levelId} updated`);
          this.levelConfigs.set(msg.levelId, msg.level);
          this.notifyListeners(msg.levelId, msg.level);
        }
        break;
    }
  }

  private notifyListeners(levelId: number, config: LevelConfig): void {
    this.listeners.forEach(listener => {
      try {
        listener(levelId, config);
      } catch (error) {
        console.error('[LevelHotReload] Listener error:', error);
      }
    });
  }

  onLevelUpdate(callback: (levelId: number, config: LevelConfig) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getLevelConfig(levelId: number): LevelConfig | undefined {
    return this.levelConfigs.get(levelId);
  }

  getAllConfigs(): LevelConfig[] {
    return Array.from(this.levelConfigs.values());
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

// Singleton instance
let hotReloadInstance: LevelHotReload | null = null;

export function getLevelHotReload(): LevelHotReload {
  if (!hotReloadInstance) {
    hotReloadInstance = new LevelHotReload();
  }
  return hotReloadInstance;
}

export function initLevelHotReload(): void {
  // Only enable in development mode
  if (import.meta.env?.DEV || process.env.NODE_ENV === 'development') {
    const hotReload = getLevelHotReload();
    hotReload.connect();
    
    // Auto-disconnect on page unload
    window.addEventListener('beforeunload', () => {
      hotReload.disconnect();
    });
  }
}
