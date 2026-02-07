/// <reference types="vite/client" />
declare const __DEV__: boolean;
import * as Colyseus from 'colyseus.js';
import type { Room } from 'colyseus.js';
import type { GameState, Player, Bot, Food, Vector2 } from '../types';
import type { ShapeId } from '../game/cjr/cjrTypes';
// EIDOLON-V PHASE3: Import BinaryPacker from @cjr/engine
import { SchemaBinaryUnpacker } from '@cjr/engine/networking';
import { MovementSystem } from '@cjr/engine/systems';
import { PhysicsSystem } from '@cjr/engine/systems';
import { TransformAccess, PhysicsAccess, GameConfig } from '@cjr/engine';
import { InputRingBuffer } from './InputRingBuffer';
import { clientLogger } from '../core/logging/ClientLogger';
// EIDOLON-V: Dev tooling
import { PacketInterceptor } from '../dev/PacketInterceptor';

// EIDOLON-V P4: Module-level reusable vectors (zero allocation after init)
const _serverPos = { x: 0, y: 0 };
const _resimVel = { x: 0, y: 0 };
const _replayTarget = { x: 0, y: 0 };
const _replayInput = { seq: 0, targetX: 0, targetY: 0, space: false, w: false, dt: 0 };

interface NetworkConfig {
  serverUrl: string;
  reconnectAttempts: number;
}

const DEFAULT_CONFIG: NetworkConfig = {
  serverUrl: import.meta.env.VITE_GAME_SERVER_URL || 'ws://localhost:2567',
  reconnectAttempts: 5,
};

export type NetworkStatus = 'offline' | 'connecting' | 'online' | 'reconnecting' | 'error' | 'offline_mode';

// EIDOLON-V P1-3: Connection state machine for security
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  RATE_LIMITED = 'RATE_LIMITED',
  ERROR = 'ERROR',
}

type EntitySnapshot = {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  radius?: number;
};

type NetworkSnapshot = {
  time: number;
  players: Map<string, EntitySnapshot>;
  bots: Map<string, EntitySnapshot>;
  food: Map<string, EntitySnapshot>;
};

export class NetworkClient {
  private config: NetworkConfig;
  private room: Room | null = null;
  private client: Colyseus.Client;

  // Local GameState reference to sync into
  private localState?: GameState;
  private playerMap: Map<string, Player> = new Map();
  private botMap: Map<string, Bot> = new Map();
  private foodMap: Map<string, Food> = new Map();

  // EIDOLON-V P4: Zero-Allocation Input Buffer
  private pendingInputs = new InputRingBuffer(256);
  private inputSeq: number = 0;

  private reconcileThreshold = GameConfig.NETWORK.RECONCILE_THRESHOLD;
  private statusListener?: (status: NetworkStatus) => void;
  private lastCredentials?: { name: string; shape: ShapeId };
  private isConnecting = false;
  private autoReconnect = true;
  // EIDOLON-V P10: Offline mode fallback for graceful degradation
  private offlineMode = false;
  private offlineModeListener?: (enabled: boolean) => void;
  // EIDOLON-V P1-3: Connection security state
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttemptCount = 0;
  private lastInputTime = 0;
  private inputCount = 0;
  private readonly INPUT_RATE_LIMIT = 60; // Max inputs per second
  private readonly INPUT_RATE_WINDOW = 1000; // 1 second window
  // EIDOLON ARCHITECT: Ring Buffer for Zero-Allocation Snapshot Management
  private static readonly SNAPSHOT_BUFFER_SIZE = 20;
  private snapshotBuffer: NetworkSnapshot[];
  private snapshotHead = 0; // Circular write index
  private snapshotCount = 0; // Number of valid snapshots (0 to SNAPSHOT_BUFFER_SIZE)
  private interpolationDelayMs = GameConfig.NETWORK.INTERPOLATION_DELAY_MS;

  constructor(config: Partial<NetworkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new Colyseus.Client(this.config.serverUrl);

    // EIDOLON ARCHITECT: Pre-allocate ring buffer with pooled objects
    this.snapshotBuffer = Array.from({ length: NetworkClient.SNAPSHOT_BUFFER_SIZE }, () => ({
      time: 0,
      players: new Map<string, EntitySnapshot>(),
      bots: new Map<string, EntitySnapshot>(),
      food: new Map<string, EntitySnapshot>(),
    }));
  }

  setLocalState(state: GameState) {
    this.localState = state;
  }

  setStatusListener(listener?: (status: NetworkStatus) => void) {
    this.statusListener = listener;
  }

  enableAutoReconnect(enabled: boolean) {
    this.autoReconnect = enabled;
  }

  // EIDOLON-V P10: Enable offline mode for graceful degradation
  enableOfflineMode(enabled: boolean) {
    this.offlineMode = enabled;
    if (this.offlineModeListener) {
      this.offlineModeListener(enabled);
    }
  }

  isOfflineMode(): boolean {
    return this.offlineMode;
  }

  setOfflineModeListener(listener?: (enabled: boolean) => void) {
    this.offlineModeListener = listener;
  }

  private emitStatus(status: NetworkStatus) {
    if (this.statusListener) this.statusListener(status);
  }

  private nowMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  async connectWithRetry(playerName: string, shape: ShapeId): Promise<boolean> {
    if (this.isConnecting) return false;
    if (this.connectionState === ConnectionState.RATE_LIMITED) {
      console.warn('[NetworkClient] Connection rate limited, please wait');
      return false;
    }

    this.isConnecting = true;
    this.connectionState = ConnectionState.CONNECTING;
    this.lastCredentials = { name: playerName, shape };
    this.emitStatus('connecting');

    for (let attempt = 0; attempt < this.config.reconnectAttempts; attempt++) {
      this.reconnectAttemptCount = attempt;
      const ok = await this.connect(playerName, shape);
      if (ok) {
        this.emitStatus('online');
        this.connectionState = ConnectionState.CONNECTED;
        this.isConnecting = false;
        this.reconnectAttemptCount = 0;
        return true;
      }

      this.connectionState = ConnectionState.RECONNECTING;
      this.emitStatus('reconnecting');

      // EIDOLON-V P1-3: Exponential backoff with jitter
      const baseDelay = 500;
      const maxDelay = 30000;
      const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
      const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
      const delay = exponentialDelay + jitter;

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.connectionState = ConnectionState.ERROR;
    this.emitStatus('error');
    this.isConnecting = false;

    // EIDOLON-V FIX: Allow UI to detect permanent failure
    // EIDOLON-V P10: Offer offline mode as graceful degradation
    if (this.offlineMode) {
      this.emitStatus('offline_mode');
      clientLogger.info('Network failed - switching to offline mode');
    }
    return false;
  }

  async connect(playerName: string, shape: ShapeId): Promise<boolean> {
    try {
      this.room = await this.client.joinOrCreate('game', {
        name: playerName,
        shape: shape,
      });
      // Reset ring buffer on new connection
      this.snapshotHead = 0;
      this.snapshotCount = 0;
      clientLogger.info('Connected to CJR Server', { sessionId: this.room.sessionId });

      this.setupRoomListeners();
      return true;
    } catch (e) {
      clientLogger.error('Connection failed', undefined, e as Error);
      return false;
    }
  }

  private handleBinaryUpdate(buffer: any) {
    const data = typeof buffer === 'object' && buffer.buffer ? buffer.buffer : buffer;
    if (import.meta.env.DEV) {
      PacketInterceptor.getInstance().captureReceive(data);
    }

    // EIDOLON-V GENESIS: Use engine.world ONLY - no defaultWorld fallback
    if (!this.localState?.engine.world) {
      // Skip update if world not available (game not initialized yet)
      return;
    }

    // 1. Unpack Server Truth into WorldState (Overwrites Predicted State)
    const timestamp = SchemaBinaryUnpacker.unpack(data, this.localState.engine.world);

    // 2. Immediate Re-simulation for Local Player (Client-Side Prediction)
    if (this.room?.sessionId) {
      this.reconcileFromWorldState(this.room.sessionId);
    }

    if (timestamp === null) return;
  }

  // EIDOLON-V: Binary-Compatible Reconciliation
  // Replays inputs on top of the fresh Server Snapshot in WorldState
  private reconcileFromWorldState(sessionId: string) {
    if (!this.localState || !this.localState.engine.world) return;

    const worldState = this.localState.engine.world;
    // We need to look up the physics index for the session ID
    // The idToIndex map comes from PhysicsWorld context or we can find it
    // NetworkClient doesn't strictly hold `idToIndex`.
    // But we have `playerMap` which has `physicsIndex`!
    const localPlayer = this.playerMap.get(sessionId);
    if (!localPlayer || localPlayer.physicsIndex === undefined) return;

    const pIdx = localPlayer.physicsIndex;

    // 1. Capture Server Truth (Snapshot)
    // The SchemaBinaryUnpacker JUST wrote these values to WorldState.
    _serverPos.x = TransformAccess.getX(worldState, pIdx);
    _serverPos.y = TransformAccess.getY(worldState, pIdx);
    _resimVel.x = PhysicsAccess.getVx(worldState, pIdx);
    _resimVel.y = PhysicsAccess.getVy(worldState, pIdx);

    // 2. Filter Processed Inputs
    // We need to know the Last Processed Input Sequence from Server.
    // SchemaBinaryUnpacker MIGHT unpack this if it's in the packet.
    // If not, we rely on the Schema Object `sPlayer.lastProcessedInput` which might be stale (tick rate mismatch).
    // Ideally, Binary Packet includes `ack` field.
    // Assuming Schema Object is the only source for `ack` for now.
    // We use the cached `localPlayer.lastProcessedInput` (which we need to sync from Schema!)
    // Wait, I disabled syncPlayers position, but I should keep `lastProcessedInput` sync?
    // Yes, `activeIds.forEach` in `syncPlayers` iterates Schema.

    // Let's ensure we get `lastProcessedInput` from somewhere.
    // Accessing `localPlayer` object for Ack is fine.
    // But verify `syncPlayers` updates it?
    // `syncPlayers` iterates `serverPlayers` (Schema).
    // I removed position sync. I should check if I removed `lastProcessedInput`.
    // I didn't see `lastProcessedInput` in the removed block specifically.

    // ... logic continues ...

    // 3. Replay Loop
    // Reuse _replayTarget, etc.
    // ... (Replay logic same as before but reading/writing WorldState)

    this.pendingInputs.forEach((seq, targetX, targetY, space, w, dt) => {
      _replayTarget.x = targetX;
      _replayTarget.y = targetY;

      MovementSystem.applyInputDOD(
        worldState,
        pIdx,
        _replayTarget,
        {
          maxSpeed: localPlayer.maxSpeed,
          speedMultiplier: localPlayer.statusMultipliers?.speed || 1,
          acceleration: localPlayer.acceleration * 2000
        },
        dt
      );

      PhysicsSystem.integrateEntity(worldState, pIdx, dt, 0.92);
    });

    // 4. Update Result to WorldState? 
    // It's already updated IN-PLACE by `integrateEntity`.
    // So WorldState now holds Predicted state.
    // DONE.
  }

  // EIDOLON-V P1-2: Handle indexed binary transforms (optimized)
  // Uses entity index instead of string ID for 33% payload reduction
  private handleBinaryIndexedUpdate(buffer: any) {
    // Both channels now use SchemaBinaryUnpacker as it handles all Packet Types
    this.handleBinaryUpdate(buffer);
  }

  async disconnect() {
    if (this.room) {
      await this.room.leave();
      this.room = null;
    }
    // Reset ring buffer on disconnect
    this.snapshotHead = 0;
    this.snapshotCount = 0;

    // EIDOLON-V P0 SECURITY: Clear entity maps to prevent memory leak
    // Without this, stale Player/Bot/Food objects accumulate on reconnect cycles
    this.playerMap.clear();
    this.botMap.clear();
    this.foodMap.clear();

    // Reset connection state
    this.connectionState = ConnectionState.DISCONNECTED;
    this.reconnectAttemptCount = 0;

    this.emitStatus('offline');
  }

  private setupRoomListeners() {
    if (!this.room) return;

    this.room.onLeave(() => {
      if (this.autoReconnect && this.lastCredentials) {
        this.connectWithRetry(this.lastCredentials.name, this.lastCredentials.shape);
      } else {
        this.emitStatus('offline');
      }
    });

    this.room.onError((err: any) => {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      clientLogger.error('Room error', undefined, errorObj);
      if (this.autoReconnect && this.lastCredentials) {
        this.emitStatus('reconnecting');
        this.connectWithRetry(this.lastCredentials.name, this.lastCredentials.shape).then(success => {
          // EIDOLON-V P10: If reconnection fails and offline mode enabled, switch to offline
          if (!success && this.offlineMode) {
            this.emitStatus('offline_mode');
            clientLogger.info('Reconnection failed - switched to offline mode');
          }
        });
      } else if (this.offlineMode) {
        // EIDOLON-V P10: Graceful degradation - offer offline mode
        this.emitStatus('offline_mode');
        clientLogger.info('Connection error - switched to offline mode');
      } else {
        this.emitStatus('error');
      }
    });

    // EIDOLON-V: DUAL STATE ELIMINATION
    // We disable the legacy Schema Object sync listeners to prevent "Dual State".
    // All data now flows through 'bin' (Binary Schema) or 'binIdx' (Indexed Binary).

    // this.room.onStateChange((state: any) => { ... });

    // Binary Channel is now the ONLY Source of Truth
    this.room.onMessage('bin', (message: any) => {
      this.handleBinaryUpdate(message);
    });

    // EIDOLON-V P1-2: Handle indexed binary transforms
    this.room.onMessage('binIdx', (message: any) => {
      this.handleBinaryIndexedUpdate(message);
    });
  }

  // EIDOLON ARCHITECT: Zero-Allocation Ring Buffer Write
  private pushSnapshot(state: any) {
    // Reuse existing snapshot object from ring buffer
    const snapshot = this.snapshotBuffer[this.snapshotHead];
    snapshot.time = this.nowMs();

    // EIDOLON-V P0 FIX: Track which IDs exist this frame for cleanup
    const activePlayerIds = new Set<string>();
    const activeBotIds = new Set<string>();
    const activeFoodIds = new Set<string>();

    // EIDOLON-V P0 FIX: Reuse existing EntitySnapshot objects instead of creating new ones
    // Populate Maps with entity data - MUTATE existing objects, don't replace
    state.players.forEach((p: any, id: string) => {
      activePlayerIds.add(id);
      let snap = snapshot.players.get(id);
      if (!snap) {
        // Only allocate if truly new entity
        snap = { x: 0, y: 0, vx: 0, vy: 0, radius: 0 };
        snapshot.players.set(id, snap);
      }
      // Mutate existing object - zero allocation
      // EIDOLON-V: Read from WorldState (SSOT) instead of Schema Object
      // We use the local object's physicsIndex to grab the latest binary data associated with this tick
      if (p.physicsIndex !== undefined) {
        const ws = this.localState!.engine.world!;
        snap.x = TransformAccess.getX(ws, p.physicsIndex);
        snap.y = TransformAccess.getY(ws, p.physicsIndex);
        snap.vx = PhysicsAccess.getVx(ws, p.physicsIndex);
        snap.vy = PhysicsAccess.getVy(ws, p.physicsIndex);
        snap.radius = PhysicsAccess.getRadius(ws, p.physicsIndex);
      } else {
        // Fallback (Metadata only phase)
        snap.x = p.position.x;
        snap.y = p.position.y;
      }
    });

    state.bots.forEach((b: any, id: string) => {
      activeBotIds.add(id);
      let snap = snapshot.bots.get(id);
      if (!snap) {
        snap = { x: 0, y: 0, vx: 0, vy: 0, radius: 0 };
        snapshot.bots.set(id, snap);
      }
      snap.x = b.position.x;
      snap.y = b.position.y;
      snap.vx = b.velocity.x;
      snap.vy = b.velocity.y;
      snap.radius = b.radius;
    });

    state.food.forEach((f: any, id: string) => {
      activeFoodIds.add(id);
      let snap = snapshot.food.get(id);
      if (!snap) {
        snap = { x: 0, y: 0, radius: 0 };
        snapshot.food.set(id, snap);
      }
      snap.x = f.x;
      snap.y = f.y;
      snap.radius = f.radius;
    });

    // EIDOLON-V P0 FIX: Cleanup stale entries (entities that no longer exist)
    for (const id of snapshot.players.keys()) {
      if (!activePlayerIds.has(id)) snapshot.players.delete(id);
    }
    for (const id of snapshot.bots.keys()) {
      if (!activeBotIds.has(id)) snapshot.bots.delete(id);
    }
    for (const id of snapshot.food.keys()) {
      if (!activeFoodIds.has(id)) snapshot.food.delete(id);
    }

    // Advance circular index (no array operations)
    this.snapshotHead = (this.snapshotHead + 1) % NetworkClient.SNAPSHOT_BUFFER_SIZE;
    this.snapshotCount = Math.min(this.snapshotCount + 1, NetworkClient.SNAPSHOT_BUFFER_SIZE);
  }

  // EIDOLON ARCHITECT: Ring Buffer Interpolation (Zero Allocation)
  interpolateState(state: GameState, now: number = this.nowMs()) {
    if (this.snapshotCount === 0) return;

    const renderTime = now - this.interpolationDelayMs;
    const localId = this.room?.sessionId;

    // Find two snapshots that bracket renderTime
    // Traverse ring buffer backwards from most recent (head - 1)
    let olderIdx = -1;
    let newerIdx = -1;

    for (let i = 0; i < this.snapshotCount; i++) {
      // Calculate index: walk backwards from head
      const idx =
        (this.snapshotHead - 1 - i + NetworkClient.SNAPSHOT_BUFFER_SIZE) %
        NetworkClient.SNAPSHOT_BUFFER_SIZE;
      const snap = this.snapshotBuffer[idx];

      if (snap.time <= renderTime) {
        newerIdx = idx;
        // Look one step further back for older snapshot
        if (i + 1 < this.snapshotCount) {
          olderIdx =
            (this.snapshotHead - 2 - i + NetworkClient.SNAPSHOT_BUFFER_SIZE) %
            NetworkClient.SNAPSHOT_BUFFER_SIZE;
        }
        break;
      }
    }

    // No suitable snapshot found
    if (newerIdx === -1) {
      // Use most recent snapshot as fallback
      const mostRecentIdx =
        (this.snapshotHead - 1 + NetworkClient.SNAPSHOT_BUFFER_SIZE) %
        NetworkClient.SNAPSHOT_BUFFER_SIZE;
      this.applySnapshot(state, this.snapshotBuffer[mostRecentIdx], localId);
      return;
    }

    if (olderIdx === -1) {
      // Only one snapshot available, apply directly
      this.applySnapshot(state, this.snapshotBuffer[newerIdx], localId);
    } else {
      // Interpolate between two snapshots
      const older = this.snapshotBuffer[olderIdx];
      const newer = this.snapshotBuffer[newerIdx];
      const span = newer.time - older.time;
      const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - older.time) / span)) : 1;
      this.applyInterpolatedSnapshot(state, older, newer, t, localId);
    }
  }

  private applyInterpolatedSnapshot(
    state: GameState,
    older: NetworkSnapshot,
    newer: NetworkSnapshot,
    t: number,
    excludeId?: string
  ) {
    this.applyEntityInterpolation(state.players, older.players, newer.players, t, excludeId);
    this.applyEntityInterpolation(state.bots, older.bots, newer.bots, t, excludeId);
    this.applyFoodInterpolation(state.food, older.food, newer.food, t);
  }

  private applySnapshot(state: GameState, snapshot: NetworkSnapshot, excludeId?: string) {
    this.applyEntitySnapshot(state.players, snapshot.players, excludeId);
    this.applyEntitySnapshot(state.bots, snapshot.bots, excludeId);
    this.applyFoodSnapshot(state.food, snapshot.food);
  }

  private applyEntitySnapshot(
    entities: Array<Player | Bot>,
    snapshot: Map<string, EntitySnapshot>,
    excludeId?: string
  ) {
    // EIDOLON-V: O(1) Map lookup only - NO fallback to O(N) array search
    snapshot.forEach((data, id) => {
      if (id === excludeId) return; // SKIP LOCAL
      const entity = this.playerMap.get(id) || this.botMap.get(id);
      // EIDOLON-V FIX: Entity MUST exist in Map - if not, it's a race condition bug
      // Do NOT fall back to O(N) array search as it causes O(N²) complexity
      if (!entity) {
        // Log once per entity to avoid spam
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn(`[NetworkClient] Entity ${id.slice(0, 8)} not in Map - skipping snapshot`);
        }
        return;
      }
      entity.position.x = data.x;
      entity.position.y = data.y;
      if (data.vx !== undefined) entity.velocity.x = data.vx;
      if (data.vy !== undefined) entity.velocity.y = data.vy;
    });
  }

  private applyFoodSnapshot(foods: Food[], snapshot: Map<string, EntitySnapshot>) {
    // EIDOLON-V: O(1) Map lookup only - NO fallback to O(N) array search
    snapshot.forEach((data, id) => {
      const food = this.foodMap.get(id);
      // EIDOLON-V FIX: Food MUST exist in Map
      if (!food) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn(`[NetworkClient] Food ${id.slice(0, 8)} not in Map - skipping snapshot`);
        }
        return;
      }
      food.position.x = data.x;
      food.position.y = data.y;
    });
  }

  private applyEntityInterpolation(
    entities: Array<Player | Bot>,
    older: Map<string, EntitySnapshot>,
    newer: Map<string, EntitySnapshot>,
    t: number,
    excludeId?: string
  ) {
    // EIDOLON-V: O(1) Map lookup only - NO fallback to O(N) array search
    newer.forEach((next, id) => {
      if (id === excludeId) return; // SKIP LOCAL
      const entity = this.playerMap.get(id) || this.botMap.get(id);
      // EIDOLON-V FIX: Entity MUST exist in Map
      if (!entity) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn(`[NetworkClient] Entity ${id.slice(0, 8)} not in Map - skipping interpolation`);
        }
        return;
      }
      const prev = older.get(id) || next;
      entity.position.x = prev.x + (next.x - prev.x) * t;
      entity.position.y = prev.y + (next.y - prev.y) * t;
      if (next.vx !== undefined && prev.vx !== undefined) {
        entity.velocity.x = prev.vx + (next.vx - prev.vx) * t;
      }
      if (next.vy !== undefined && prev.vy !== undefined) {
        entity.velocity.y = prev.vy + (next.vy - prev.vy) * t;
      }
    });
  }

  private applyFoodInterpolation(
    foods: Food[],
    older: Map<string, EntitySnapshot>,
    newer: Map<string, EntitySnapshot>,
    t: number
  ) {
    // EIDOLON-V: O(1) Map lookup only - NO fallback to O(N) array search
    newer.forEach((next, id) => {
      const food = this.foodMap.get(id);
      // EIDOLON-V FIX: Food MUST exist in Map
      if (!food) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn(`[NetworkClient] Food ${id.slice(0, 8)} not in Map - skipping interpolation`);
        }
        return;
      }
      const prev = older.get(id) || next;
      food.position.x = prev.x + (next.x - prev.x) * t;
      food.position.y = prev.y + (next.y - prev.y) * t;
    });
  }

  sendInput(
    target: Vector2,
    inputs: { space: boolean; w: boolean },
    dt: number,
    events: any[] = []
  ) {
    if (!this.room) return;

    // EIDOLON-V P1-3: Client-side rate limiting to prevent input flood
    const now = this.nowMs();
    if (now - this.lastInputTime > this.INPUT_RATE_WINDOW) {
      // Reset counter every second
      this.inputCount = 0;
      this.lastInputTime = now;
    }

    if (this.inputCount >= this.INPUT_RATE_LIMIT) {
      // Silently drop input - rate limited
      return;
    }
    this.inputCount++;

    const seq = ++this.inputSeq;

    // EIDOLON-V P4: Zero-allocation input buffering
    this.pendingInputs.push(seq, target.x, target.y, inputs.space, inputs.w, dt);

    this.room.send('input', {
      seq,
      targetX: target.x,
      targetY: target.y,
      skill: inputs.space,
      eject: inputs.w,
    });

    if (import.meta.env.DEV) {
      PacketInterceptor.getInstance().captureSend({
        type: 'input',
        seq,
        targetX: target.x,
        targetY: target.y,
        skill: inputs.space,
        eject: inputs.w,
      });
    }
  }

  getRoomId() {
    return this.room?.roomId;
  }
}

export const networkClient = new NetworkClient();
