
import * as Colyseus from 'colyseus.js';
import type { Room } from 'colyseus.js';
import type { GameState, Player, Bot, Food, Projectile, Vector2 } from '../../types';
import type { PigmentVec3, ShapeId, Emotion, PickupKind, TattooId } from '../cjr/cjrTypes';
import { createDefaultStatusTimers, createDefaultStatusMultipliers, createDefaultStatusScalars } from '../../types/status';
import { StatusFlag } from '../engine/statusFlags';
import { BinaryPacker } from './BinaryPacker';
import { MovementSystem } from '../engine/dod/systems/MovementSystem';
import { PhysicsSystem } from '../engine/dod/systems/PhysicsSystem';
import { TransformStore, PhysicsStore } from '../engine/dod/ComponentStores';

interface NetworkConfig {
  serverUrl: string;
  reconnectAttempts: number;
}

const DEFAULT_CONFIG: NetworkConfig = {
  serverUrl: 'ws://localhost:2567',
  reconnectAttempts: 5,
};

export type NetworkStatus = 'offline' | 'connecting' | 'online' | 'reconnecting' | 'error';

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

  // Client-Side Prediction
  private pendingInputs: {
    seq: number;
    target: { x: number; y: number };
    inputs: { space: boolean; w: boolean };
    dt: number;
  }[] = [];
  private inputSeq: number = 0;

  private reconcileThreshold = 20; // 20px allowance
  private statusListener?: (status: NetworkStatus) => void;
  private lastCredentials?: { name: string; shape: ShapeId };
  private isConnecting = false;
  private autoReconnect = true;
  private snapshots: NetworkSnapshot[] = [];
  private interpolationDelayMs = 100;

  constructor(config: Partial<NetworkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new Colyseus.Client(this.config.serverUrl);
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

  private emitStatus(status: NetworkStatus) {
    if (this.statusListener) this.statusListener(status);
  }

  private nowMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  async connectWithRetry(playerName: string, shape: ShapeId): Promise<boolean> {
    if (this.isConnecting) return false;
    this.isConnecting = true;
    this.lastCredentials = { name: playerName, shape };
    this.emitStatus('connecting');

    for (let attempt = 0; attempt < this.config.reconnectAttempts; attempt++) {
      const ok = await this.connect(playerName, shape);
      if (ok) {
        this.emitStatus('online');
        this.isConnecting = false;
        return true;
      }
      this.emitStatus('reconnecting');
      await new Promise(resolve => setTimeout(resolve, 800 + attempt * 400));
    }

    this.emitStatus('error');
    this.isConnecting = false;
    return false;
  }

  async connect(playerName: string, shape: ShapeId): Promise<boolean> {
    try {
      this.room = await this.client.joinOrCreate('game', {
        name: playerName,
        shape: shape
      });
      this.snapshots = [];
      console.log('Connected to CJR Server', this.room.sessionId);

      this.setupRoomListeners();
      return true;
    } catch (e) {
      console.error('Connection failed', e);
      return false;
    }
  }


  private handleBinaryUpdate(buffer: any) {
    // Buffer is likely Uint8Array or ArrayBuffer
    const data = typeof buffer === 'object' && buffer.buffer ? buffer.buffer : buffer;
    const result = BinaryPacker.unpackTransforms(data);

    if (result) {
      // Create a synthetic snapshot or merge into current interpolation buffer
      // We need to map binary update to EntitySnapshot format
      const players = new Map<string, EntitySnapshot>();
      const bots = new Map<string, EntitySnapshot>();

      // We don't know if id maps to player or bot easily without lookup.
      // But applyEntityInterpolation handles map lookup.
      // So we can put ALL in players map? No, applyInterpolation iterates "newer".
      // We need to know which map to put them in.

      // Optimization: Check existing maps
      result.updates.forEach(u => {
        const snap = { x: u.x, y: u.y, vx: u.vx, vy: u.vy, radius: 0 }; // radius unknown in pure bin
        if (this.playerMap.has(u.id)) {
          players.set(u.id, snap);
        } else if (this.botMap.has(u.id)) {
          bots.set(u.id, snap);
        }
      });

      // Use the timestamp from packet
      this.snapshots.push({
        time: this.nowMs(), // Use local arrival time for smooth interpolation buffer? Or server time?
        // Server time (result.timestamp) is authoritative but clocks differ. Needs offset.
        // For now, using local arrival time is robust for interpolation buffer (jitter buffer).
        players,
        bots,
        food: new Map() // Food not in binary yet
      });

      if (this.snapshots.length > 10) this.snapshots.shift();
    }
  }

  async disconnect() {
    if (this.room) {
      await this.room.leave();
      this.room = null;
    }
    this.snapshots = [];
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

    this.room.onError(() => {
      if (this.autoReconnect && this.lastCredentials) {
        this.emitStatus('reconnecting');
        this.connectWithRetry(this.lastCredentials.name, this.lastCredentials.shape);
      } else {
        this.emitStatus('error');
      }
    });

    this.room.onStateChange((state: any) => {
      if (!this.localState) return;

      this.syncPlayers(state.players);

      // Sync Bots as array
      // We need to map MapSchema to our Array
      this.syncBots(state.bots); // Bots
      this.syncFood(state.food); // Food
      this.localState.gameTime = state.gameTime ?? this.localState.gameTime;
      this.pushSnapshot(state);
    });

    this.room.onMessage('bin', (message: any) => {
      this.handleBinaryUpdate(message);
    });
  }

  private syncPlayers(serverPlayers: any) {
    if (!this.localState || !this.room) return;

    const activeIds = new Set<string>();

    // O(N) Iteration over server state
    serverPlayers.forEach((sPlayer: any, sessionId: string) => {
      activeIds.add(sessionId);
      let localPlayer = this.playerMap.get(sessionId);

      if (!localPlayer) {
        // Create new player (Once)
        localPlayer = {
          id: sessionId,
          // ... (Initialize with server values)
          position: { x: sPlayer.position.x, y: sPlayer.position.y },
          velocity: { x: sPlayer.velocity.x, y: sPlayer.velocity.y },
          radius: sPlayer.radius,
          color: '#ffffff',
          isDead: sPlayer.isDead,
          trail: [],
          name: sPlayer.name,
          score: sPlayer.score,
          kills: sPlayer.kills,
          maxHealth: sPlayer.maxHealth,
          currentHealth: sPlayer.currentHealth,
          tier: 0 as any,
          targetPosition: { x: sPlayer.position.x, y: sPlayer.position.y },
          spawnTime: 0,
          pigment: { r: sPlayer.pigment.r, g: sPlayer.pigment.g, b: sPlayer.pigment.b },
          targetPigment: { r: sPlayer.targetPigment.r, g: sPlayer.targetPigment.g, b: sPlayer.targetPigment.b },
          matchPercent: sPlayer.matchPercent,
          ring: sPlayer.ring,
          emotion: sPlayer.emotion,
          shape: sPlayer.shape,
          tattoos: [...(sPlayer.tattoos ?? [])],
          statusFlags: sPlayer.statusFlags || 0,
          tattooFlags: 0, // Sync if available
          extendedFlags: 0,
          statusTimers: createDefaultStatusTimers(),
          statusMultipliers: createDefaultStatusMultipliers(),
          statusScalars: createDefaultStatusScalars(),

          // Defaults to avoid nulls
          lastHitTime: 0, lastEatTime: 0, matchStuckTime: 0, ring3LowMatchTime: 0, emotionTimer: 0,
          acceleration: 1, maxSpeed: 1, friction: 1, isInvulnerable: false,
          skillCooldown: 0, maxSkillCooldown: 5, defense: 1, damageMultiplier: 1,
          critChance: 0, critMultiplier: 1, lifesteal: 0, armorPen: 0, reflectDamage: 0,
          visionMultiplier: 1, sizePenaltyMultiplier: 1, skillCooldownMultiplier: 1,
          skillPowerMultiplier: 1, skillDashMultiplier: 1, killGrowthMultiplier: 1,
          poisonOnHit: false, doubleCast: false, reviveAvailable: false, magneticFieldRadius: 0,
          mutationCooldowns: {
            speedSurge: 0, invulnerable: 0, rewind: 0, lightning: 0, chaos: 0, kingForm: 0
          },
          rewindHistory: [], stationaryTime: 0
        } as unknown as Player; // Cast for now


        this.playerMap.set(sessionId, localPlayer);
        this.localState!.players.push(localPlayer);

        // EIDOLON-V FIX: Sync to PhysicsWorld
        localPlayer.physicsIndex = this.localState!.engine.physicsWorld.addBody(
          sessionId,
          localPlayer.position.x,
          localPlayer.position.y,
          localPlayer.radius,
          1, // Mass (calculated later or defaulting) - TODO: Calculate mass properly
          true
        );
      }

      // Sync Properties (O(1))
      localPlayer.score = sPlayer.score;
      localPlayer.currentHealth = sPlayer.currentHealth;
      localPlayer.kills = sPlayer.kills;
      localPlayer.matchPercent = sPlayer.matchPercent;
      localPlayer.ring = sPlayer.ring;
      localPlayer.emotion = sPlayer.emotion as Emotion;
      localPlayer.isDead = sPlayer.isDead;
      localPlayer.radius = sPlayer.radius;

      // Local Player Reconciliation
      if (sessionId === this.room?.sessionId) {
        this.reconcileLocalPlayer(localPlayer, sPlayer);
        this.localState!.player = localPlayer;
      } else {
        localPlayer.position.x = sPlayer.position.x;
        localPlayer.position.y = sPlayer.position.y;
        localPlayer.velocity.x = sPlayer.velocity.x;
        localPlayer.velocity.y = sPlayer.velocity.y;
      }

      // EIDOLON-V FIX: Update PhysicsWorld
      this.localState!.engine.physicsWorld.syncBody(
        sessionId,
        localPlayer.position.x,
        localPlayer.position.y,
        localPlayer.velocity.x,
        localPlayer.velocity.y
      );
    });

    // Cleanup Dead (O(M) where M is local count)
    if (this.playerMap.size > activeIds.size) {
      for (const [id, p] of this.playerMap) {
        if (!activeIds.has(id)) {
          p.isDead = true;
          this.localState!.engine.physicsWorld.removeBody(id); // EIDOLON-V FIX: Remove from PhysicsWorld
          this.playerMap.delete(id);
        }
      }
      // Rebuild array only when size mismatches
      this.localState.players = Array.from(this.playerMap.values());
    }
  }

  private reconcileLocalPlayer(localPlayer: Player, sPlayer: any) {
    const lastProcessed = sPlayer.lastProcessedInput || 0;

    // Remove processed inputs
    this.pendingInputs = this.pendingInputs.filter(input => input.seq > lastProcessed);

    // Current State (Predicted) vs Server State (Authoritative)
    // We want to verify if our prediction was correct.
    // Ideally we resimulate FROM server state with pending inputs.

    // 1. Reset to Server State
    const serverPos = { x: sPlayer.position.x, y: sPlayer.position.y };

    // Calculate Error before correction (for Teleport check vs Smooth Correction)
    // But we need the 'Re-simulated' position to know the TRUE error.
    // Error = CurrentLocal - (Server + ReplayedInputs).

    // Clone server state for re-simulation
    const resimPos = { x: sPlayer.position.x, y: sPlayer.position.y };
    const resimVel = { x: sPlayer.velocity.x, y: sPlayer.velocity.y };

    // 2. Re-simulate Pending Inputs
    // We need access to PhysicsWorld for map constraints, but simplistic re-sim is okay if map is simple.
    // However, we enabled 'integrateEntity' in PhysicsSystem for this.
    // But PhysicsSystem writes to Stores. We shouldn't mess up global stores if possible, 
    // OR we accept that Local Player IS in the store and we update it.

    const world = this.localState?.engine.physicsWorld;
    if (world && localPlayer.physicsIndex !== undefined) {
      // Sync Server State to DOD
      TransformStore.set(localPlayer.physicsIndex, serverPos.x, serverPos.y, 0, localPlayer.radius); // Rot?
      PhysicsStore.set(localPlayer.physicsIndex, resimVel.x, resimVel.y, 1, localPlayer.radius);

      // Replay Loop
      for (const input of this.pendingInputs) {
        // Apply Input -> Velocity
        MovementSystem.applyInput(
          { x: TransformStore.data[localPlayer.physicsIndex * 8], y: TransformStore.data[localPlayer.physicsIndex * 8 + 1] },
          { x: PhysicsStore.data[localPlayer.physicsIndex * 8], y: PhysicsStore.data[localPlayer.physicsIndex * 8 + 1] }, // Object wrapper for ref? No, need to write back or pass object that writes back.
          input.target,
          { maxSpeed: localPlayer.maxSpeed, speedMultiplier: localPlayer.statusMultipliers.speed || 1 },
          input.dt
        );

        // Wait, applyInput modifies the object passed.
        // We need to write that object's Vel back to Store?
        // Let's create a proxy object or just read/write manually.
        // MovementSystem.applyInput takes {x,y} objects.
        const pObj = { x: TransformStore.data[localPlayer.physicsIndex * 8], y: TransformStore.data[localPlayer.physicsIndex * 8 + 1] };
        const vObj = { x: PhysicsStore.data[localPlayer.physicsIndex * 8], y: PhysicsStore.data[localPlayer.physicsIndex * 8 + 1] };

        MovementSystem.applyInput(pObj, vObj, input.target, { maxSpeed: localPlayer.maxSpeed, speedMultiplier: localPlayer.statusMultipliers.speed || 1 }, input.dt);

        // Write Vel back
        PhysicsStore.data[localPlayer.physicsIndex * 8] = vObj.x;
        PhysicsStore.data[localPlayer.physicsIndex * 8 + 1] = vObj.y;

        // Integrate
        PhysicsSystem.integrateEntity(localPlayer.physicsIndex, input.dt, 0.9); // Friction 0.9 hardcoded or read?
      }

      // Read final Re-simulated state
      const finalX = TransformStore.data[localPlayer.physicsIndex * 8];
      const finalY = TransformStore.data[localPlayer.physicsIndex * 8 + 1];
      const finalVx = PhysicsStore.data[localPlayer.physicsIndex * 8];
      const finalVy = PhysicsStore.data[localPlayer.physicsIndex * 8 + 1];

      // Check divergence
      const dx = localPlayer.position.x - finalX;
      const dy = localPlayer.position.y - finalY;
      const distSq = dx * dx + dy * dy;

      if (distSq > this.reconcileThreshold * this.reconcileThreshold) {
        // Error too large, Snap to Re-simulated
        // Todo: Implement Smooth correction via visual offset
        localPlayer.position.x = finalX;
        localPlayer.position.y = finalY;
        localPlayer.velocity.x = finalVx;
        localPlayer.velocity.y = finalVy;
      } else {
        // Smoothly converge (Lerp)
        // localPlayer.position.x += (finalX - localPlayer.position.x) * 0.1;
        // localPlayer.position.y += (finalY - localPlayer.position.y) * 0.1;
        // Actually, if error is small, just keep local (it's smoother).
        // But we should drift towards correct.
        localPlayer.position.x = finalX; // For now snap if prediction verified (it prevents drift)
        localPlayer.position.y = finalY;
        localPlayer.velocity.x = finalVx;
        localPlayer.velocity.y = finalVy;
      }

    } else {
      // Fallback if no physics world (shouldn't happen)
      localPlayer.position.x = sPlayer.position.x;
      localPlayer.position.y = sPlayer.position.y;
    }
  }

  private syncBots(serverBots: any) {
    if (!this.localState) return;

    const activeIds = new Set<string>();

    serverBots.forEach((sBot: any, id: string) => {
      activeIds.add(id);
      let localBot = this.botMap.get(id);

      if (!localBot) {
        // Create new
        localBot = {
          id: sBot.id,
          position: { x: sBot.position.x, y: sBot.position.y },
          velocity: { x: sBot.velocity.x, y: sBot.velocity.y },
          radius: sBot.radius,
          color: '#fff',
          isDead: sBot.isDead,
          trail: [],
          name: sBot.name,
          score: sBot.score,
          kills: sBot.kills,
          maxHealth: sBot.maxHealth,
          currentHealth: sBot.currentHealth,
          pigment: { r: sBot.pigment.r, g: sBot.pigment.g, b: sBot.pigment.b },
          targetPigment: { r: sBot.targetPigment.r, g: sBot.targetPigment.g, b: sBot.targetPigment.b },
          matchPercent: sBot.matchPercent,
          ring: sBot.ring,
          emotion: sBot.emotion,
          shape: sBot.shape,
          statusEffects: { ...sBot.statusEffects },
          aiState: 'wander',
          personality: 'farmer',
          targetEntityId: null,
          aiReactionTimer: 0,
          tattoos: [],
          tier: 0 as any,
          isInvulnerable: false
        } as unknown as Bot;


        this.botMap.set(id, localBot);
        this.localState!.bots.push(localBot);

        // EIDOLON-V FIX: Sync to PhysicsWorld
        localBot.physicsIndex = this.localState!.engine.physicsWorld.addBody(
          id,
          localBot.position.x,
          localBot.position.y,
          localBot.radius,
          1, // Mass
          true
        );
      }

      // Sync Props
      localBot.position.x = sBot.position.x;
      localBot.position.y = sBot.position.y;
      localBot.velocity.x = sBot.velocity.x;
      localBot.velocity.y = sBot.velocity.y;
      localBot.currentHealth = sBot.currentHealth;
      localBot.isDead = sBot.isDead;
      localBot.pigment = sBot.pigment;
      localBot.emotion = sBot.emotion;
      localBot.radius = sBot.radius;

      // EIDOLON-V FIX: Update PhysicsWorld
      this.localState!.engine.physicsWorld.syncBody(
        id,
        localBot.position.x,
        localBot.position.y,
        localBot.velocity.x,
        localBot.velocity.y
      );
    });

    // Cleanup Dead
    if (this.botMap.size > activeIds.size) {
      for (const [id, b] of this.botMap) {
        if (!activeIds.has(id)) {
          b.isDead = true;
          this.localState!.engine.physicsWorld.removeBody(id); // EIDOLON-V FIX: Remove from PhysicsWorld
          this.botMap.delete(id);
        }
      }
      this.localState.bots = Array.from(this.botMap.values());
    }
  }

  private syncFood(serverFood: any) {
    if (!this.localState) return;

    const activeIds = new Set<string>();

    serverFood.forEach((sFood: any, id: string) => {
      activeIds.add(id);
      let localFood = this.foodMap.get(id);

      if (!localFood) {
        localFood = {
          id: sFood.id,
          position: { x: sFood.x, y: sFood.y },
          velocity: { x: 0, y: 0 },
          radius: sFood.radius,
          color: '#fff',
          isDead: sFood.isDead,
          trail: [],
          value: sFood.value,
          kind: sFood.kind as PickupKind,
          pigment: { r: sFood.pigment.r, g: sFood.pigment.g, b: sFood.pigment.b }
        };
        this.foodMap.set(id, localFood);
        this.localState!.food.push(localFood);
      }

      if (sFood.isDead) localFood.isDead = true;
      localFood.radius = sFood.radius;
      localFood.kind = sFood.kind as PickupKind;
      localFood.pigment = { r: sFood.pigment.r, g: sFood.pigment.g, b: sFood.pigment.b };
    });

    if (this.foodMap.size > activeIds.size) {
      for (const [id, f] of this.foodMap) {
        if (!activeIds.has(id)) {
          f.isDead = true;
          this.foodMap.delete(id);
        }
      }
      this.localState.food = Array.from(this.foodMap.values());
    }
  }

  private pushSnapshot(state: any) {
    const players = new Map<string, EntitySnapshot>();
    state.players.forEach((p: any, id: string) => {
      players.set(id, {
        x: p.position.x,
        y: p.position.y,
        vx: p.velocity.x,
        vy: p.velocity.y,
        radius: p.radius,
      });
    });

    const bots = new Map<string, EntitySnapshot>();
    state.bots.forEach((b: any, id: string) => {
      bots.set(id, {
        x: b.position.x,
        y: b.position.y,
        vx: b.velocity.x,
        vy: b.velocity.y,
        radius: b.radius,
      });
    });

    const food = new Map<string, EntitySnapshot>();
    state.food.forEach((f: any, id: string) => {
      food.set(id, {
        x: f.x,
        y: f.y,
        radius: f.radius,
      });
    });

    this.snapshots.push({ time: this.nowMs(), players, bots, food });
    if (this.snapshots.length > 10) this.snapshots.shift();
  }

  interpolateState(state: GameState, now: number = this.nowMs()) {
    if (this.snapshots.length === 0) return;

    const renderTime = now - this.interpolationDelayMs;
    while (this.snapshots.length >= 2 && this.snapshots[1].time <= renderTime) {
      this.snapshots.shift();
    }

    const localId = this.room?.sessionId;

    if (this.snapshots.length >= 2) {
      const [older, newer] = this.snapshots;
      const span = newer.time - older.time;
      const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - older.time) / span)) : 1;
      this.applyInterpolatedSnapshot(state, older, newer, t, localId);
    } else {
      this.applySnapshot(state, this.snapshots[0], localId);
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

  private applyEntitySnapshot(entities: Array<Player | Bot>, snapshot: Map<string, EntitySnapshot>, excludeId?: string) {
    const byId = new Map<string, Player | Bot>(entities.map(e => [e.id, e]));
    snapshot.forEach((data, id) => {
      if (id === excludeId) return; // SKIP LOCAL
      const entity = byId.get(id);
      if (!entity) return;
      entity.position.x = data.x;
      entity.position.y = data.y;
      if (data.vx !== undefined) entity.velocity.x = data.vx;
      if (data.vy !== undefined) entity.velocity.y = data.vy;
    });
  }

  private applyFoodSnapshot(foods: Food[], snapshot: Map<string, EntitySnapshot>) {
    const byId = new Map<string, Food>(foods.map(f => [f.id, f]));
    snapshot.forEach((data, id) => {
      const food = byId.get(id);
      if (!food) return;
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
    const byId = new Map<string, Player | Bot>(entities.map(e => [e.id, e]));
    newer.forEach((next, id) => {
      if (id === excludeId) return; // SKIP LOCAL
      const entity = byId.get(id);
      if (!entity) return;
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
    const byId = new Map<string, Food>(foods.map(f => [f.id, f]));
    newer.forEach((next, id) => {
      const food = byId.get(id);
      if (!food) return;
      const prev = older.get(id) || next;
      food.position.x = prev.x + (next.x - prev.x) * t;
      food.position.y = prev.y + (next.y - prev.y) * t;
    });
  }

  sendInput(target: Vector2, inputs: { space: boolean; w: boolean }, dt: number, events: any[] = []) {
    if (!this.room) return;
    const seq = ++this.inputSeq;
    this.pendingInputs.push({ seq, target: { ...target }, inputs: { ...inputs }, dt });
    this.room.send('input', {
      seq,
      targetX: target.x,
      targetY: target.y,
      skill: inputs.space,
      eject: inputs.w
    });
  }

  getRoomId() { return this.room?.roomId; }
}

export const networkClient = new NetworkClient();
