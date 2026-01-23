/**
 * GU-KING NETWORK CLIENT
 *
 * Client-side networking layer using Colyseus
 * Features:
 * - Server state synchronization
 * - Client-side prediction
 * - Entity interpolation
 * - Reconnection handling
 */

import type { Room } from 'colyseus.js';
import type { GameState, Player, Bot, Food, Projectile, Hazard, PowerUp, Vector2 } from '../../types';

// ============================================
// TYPES
// ============================================

export interface NetworkConfig {
  serverUrl: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  interpolationDelay: number;
}

export interface ServerSnapshot {
  tick: number;
  time: number;
  players: Map<string, any>;
  bots: Map<string, any>;
  food: Map<string, any>;
  projectiles: Map<string, any>;
  hazards: Map<string, any>;
  zoneRadius: number;
  gameTime: number;
  currentRound: number;
  kingId: string;
}

export interface InputPacket {
  targetX: number;
  targetY: number;
  skill: boolean;
  eject: boolean;
  seq: number;
}

export type NetworkEventType =
  | 'connected'
  | 'disconnected'
  | 'state_update'
  | 'death'
  | 'vfx_event'
  | 'error';

export interface NetworkEvent {
  type: NetworkEventType;
  data?: any;
}

type NetworkEventCallback = (event: NetworkEvent) => void;

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_CONFIG: NetworkConfig = {
  serverUrl: 'ws://localhost:2567',
  reconnectAttempts: 5,
  reconnectDelay: 2000,
  interpolationDelay: 100, // 100ms interpolation buffer
};

// ============================================
// NETWORK CLIENT CLASS
// ============================================

export class NetworkClient {
  private config: NetworkConfig;
  private room: Room | null = null;
  private eventListeners: NetworkEventCallback[] = [];
  private inputSequence = 0;
  private pendingInputs: InputPacket[] = [];
  private snapshots: ServerSnapshot[] = [];
  private maxSnapshots = 30;

  // Player state
  public sessionId: string = '';
  public isConnected: boolean = false;
  public latency: number = 0;

  constructor(config: Partial<NetworkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------- CONNECTION --------------------

  async connect(playerName: string, bloodline: string): Promise<boolean> {
    try {
      // Dynamic import to avoid SSR issues
      const { Client } = await import('colyseus.js');

      const client = new Client(this.config.serverUrl);

      this.room = await client.joinOrCreate('game', {
        name: playerName,
        bloodline: bloodline,
      });

      this.sessionId = this.room.sessionId;
      this.isConnected = true;

      this.setupRoomListeners();
      this.emit({ type: 'connected', data: { sessionId: this.sessionId } });

      console.log(`[NetworkClient] Connected to room: ${this.room.id}`);
      return true;
    } catch (error) {
      console.error('[NetworkClient] Connection failed:', error);
      this.emit({ type: 'error', data: error });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      await this.room.leave();
      this.room = null;
    }
    this.isConnected = false;
    this.sessionId = '';
    this.emit({ type: 'disconnected' });
  }

  private setupRoomListeners(): void {
    if (!this.room) return;

    // State change listener
    this.room.onStateChange((state) => {
      this.handleStateUpdate(state);
    });

    // Custom message handlers
    this.room.onMessage('death', (data) => {
      this.emit({ type: 'death', data });
    });

    this.room.onMessage('vfx', (data) => {
      this.emit({ type: 'vfx_event', data });
    });

    // Disconnect handler
    this.room.onLeave((code) => {
      console.log(`[NetworkClient] Left room with code: ${code}`);
      this.isConnected = false;
      this.emit({ type: 'disconnected', data: { code } });
    });

    // Error handler
    this.room.onError((code, message) => {
      console.error(`[NetworkClient] Room error: ${code} - ${message}`);
      this.emit({ type: 'error', data: { code, message } });
    });
  }

  // -------------------- INPUT --------------------

  sendInput(targetX: number, targetY: number): void {
    if (!this.room || !this.isConnected) return;

    const input: InputPacket = {
      targetX,
      targetY,
      skill: false,
      eject: false,
      seq: ++this.inputSequence,
    };

    // Store for reconciliation
    this.pendingInputs.push(input);
    if (this.pendingInputs.length > 60) {
      this.pendingInputs.shift();
    }

    this.room.send('input', input);
  }

  sendSkill(): void {
    if (!this.room || !this.isConnected) return;
    this.room.send('skill', {});
  }

  sendEject(): void {
    if (!this.room || !this.isConnected) return;
    this.room.send('eject', {});
  }

  // -------------------- STATE SYNC --------------------

  private handleStateUpdate(state: any): void {
    // Create snapshot
    const snapshot: ServerSnapshot = {
      tick: state.serverTick,
      time: state.serverTime,
      players: new Map(state.players.entries()),
      bots: new Map(state.bots.entries()),
      food: new Map(state.food.entries()),
      projectiles: new Map(state.projectiles.entries()),
      hazards: new Map(state.hazards.entries()),
      zoneRadius: state.zoneRadius,
      gameTime: state.gameTime,
      currentRound: state.currentRound,
      kingId: state.kingId,
    };

    // Store snapshot
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Process VFX events
    if (state.vfxEvents) {
      state.vfxEvents.forEach((event: string) => {
        this.emit({ type: 'vfx_event', data: event });
      });
    }

    // Calculate latency
    this.latency = Date.now() - state.serverTime;

    this.emit({ type: 'state_update', data: snapshot });
  }

  // -------------------- INTERPOLATION --------------------

  /**
   * Get interpolated state for rendering
   * Uses linear interpolation between two server snapshots
   */
  getInterpolatedState(localState: GameState): GameState {
    if (this.snapshots.length < 2) return localState;

    const renderTime = Date.now() - this.config.interpolationDelay;

    // Find surrounding snapshots
    let before: ServerSnapshot | null = null;
    let after: ServerSnapshot | null = null;

    for (let i = 0; i < this.snapshots.length - 1; i++) {
      if (this.snapshots[i].time <= renderTime && this.snapshots[i + 1].time >= renderTime) {
        before = this.snapshots[i];
        after = this.snapshots[i + 1];
        break;
      }
    }

    if (!before || !after) {
      // Use latest snapshot
      const latest = this.snapshots[this.snapshots.length - 1];
      return this.applySnapshot(localState, latest);
    }

    // Calculate interpolation factor
    const t = (renderTime - before.time) / (after.time - before.time);

    return this.interpolateSnapshots(localState, before, after, t);
  }

  private applySnapshot(state: GameState, snapshot: ServerSnapshot): GameState {
    // Update world state
    state.zoneRadius = snapshot.zoneRadius;
    state.gameTime = snapshot.gameTime;
    state.currentRound = snapshot.currentRound;
    state.kingId = snapshot.kingId;

    // Update player from server state
    const serverPlayer = snapshot.players.get(this.sessionId);
    if (serverPlayer && state.player) {
      // Only update if significantly different (server reconciliation)
      const dx = serverPlayer.position.x - state.player.position.x;
      const dy = serverPlayer.position.y - state.player.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > 100) {
        // Snap to server position if too far
        state.player.position.x = serverPlayer.position.x;
        state.player.position.y = serverPlayer.position.y;
      }

      // Always sync these
      state.player.radius = serverPlayer.radius;
      state.player.currentHealth = serverPlayer.currentHealth;
      state.player.score = serverPlayer.score;
      state.player.kills = serverPlayer.kills;
      state.player.isDead = serverPlayer.isDead;
    }

    // Update bots
    snapshot.bots.forEach((botData, id) => {
      let bot = state.bots.find((b) => b.id === id);
      if (bot) {
        bot.position.x = botData.position.x;
        bot.position.y = botData.position.y;
        bot.radius = botData.radius;
        bot.isDead = botData.isDead;
        bot.currentHealth = botData.currentHealth;
      }
    });

    return state;
  }

  private interpolateSnapshots(
    state: GameState,
    before: ServerSnapshot,
    after: ServerSnapshot,
    t: number
  ): GameState {
    // Clamp t
    t = Math.max(0, Math.min(1, t));

    // Interpolate world state
    state.zoneRadius = lerp(before.zoneRadius, after.zoneRadius, t);
    state.gameTime = lerp(before.gameTime, after.gameTime, t);
    state.currentRound = after.currentRound;
    state.kingId = after.kingId;

    // Interpolate other players
    after.players.forEach((afterPlayer, id) => {
      if (id === this.sessionId) return; // Don't interpolate local player

      const beforePlayer = before.players.get(id);
      if (!beforePlayer) return;

      // Find or create bot representation for other player
      let entity = state.bots.find((b) => b.id === id);
      if (entity) {
        entity.position.x = lerp(beforePlayer.position.x, afterPlayer.position.x, t);
        entity.position.y = lerp(beforePlayer.position.y, afterPlayer.position.y, t);
        entity.radius = lerp(beforePlayer.radius, afterPlayer.radius, t);
      }
    });

    // Interpolate bots
    after.bots.forEach((afterBot, id) => {
      const beforeBot = before.bots.get(id);
      if (!beforeBot) return;

      let bot = state.bots.find((b) => b.id === id);
      if (bot) {
        bot.position.x = lerp(beforeBot.position.x, afterBot.position.x, t);
        bot.position.y = lerp(beforeBot.position.y, afterBot.position.y, t);
        bot.radius = lerp(beforeBot.radius, afterBot.radius, t);
      }
    });

    return state;
  }

  // -------------------- CLIENT PREDICTION --------------------

  /**
   * Apply client-side prediction for local player
   * Makes the game feel responsive before server confirmation
   */
  predictInput(state: GameState, targetX: number, targetY: number, dt: number): void {
    if (!state.player || state.player.isDead) return;

    const player = state.player;

    // Smooth target position
    player.targetPosition.x += (targetX - player.targetPosition.x) * 0.3;
    player.targetPosition.y += (targetY - player.targetPosition.y) * 0.3;

    // Predict physics (same as server)
    const dx = player.targetPosition.x - player.position.x;
    const dy = player.targetPosition.y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const sizePenalty = 1 - (player.radius / 155) * 0.4;
    const maxSpeed = 6.8 * sizePenalty;

    if (dist > 5) {
      const accel = 1.0;
      player.velocity.x += (dx / dist) * accel;
      player.velocity.y += (dy / dist) * accel;
    }

    player.velocity.x *= 0.93;
    player.velocity.y *= 0.93;

    const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
    if (speed > maxSpeed) {
      player.velocity.x = (player.velocity.x / speed) * maxSpeed;
      player.velocity.y = (player.velocity.y / speed) * maxSpeed;
    }

    player.position.x += player.velocity.x;
    player.position.y += player.velocity.y;
  }

  // -------------------- EVENTS --------------------

  addEventListener(callback: NetworkEventCallback): void {
    this.eventListeners.push(callback);
  }

  removeEventListener(callback: NetworkEventCallback): void {
    this.eventListeners = this.eventListeners.filter((cb) => cb !== callback);
  }

  private emit(event: NetworkEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  // -------------------- GETTERS --------------------

  getLatency(): number {
    return this.latency;
  }

  getRoomId(): string | null {
    return this.room?.id || null;
  }

  getPlayerCount(): number {
    if (!this.room || !this.room.state) return 0;
    return (this.room.state as any).players?.size || 0;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const networkClient = new NetworkClient();
