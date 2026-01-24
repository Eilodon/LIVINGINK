
import * as Colyseus from 'colyseus.js';
import type { Room } from 'colyseus.js';
import type { GameState, Player, Bot, Food, Projectile, Vector2 } from '../../types';
import type { PigmentVec3, ShapeId, Emotion, PickupKind, TattooId } from '../cjr/cjrTypes';

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
  private localState: GameState | null = null;
  private inputSeq = 0;
  private pendingInputs: Array<{ seq: number; target: Vector2; inputs: { space: boolean; w: boolean } }> = [];
  private reconcileThreshold = 18;
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
  }

  private syncPlayers(serverPlayers: any) {
    if (!this.localState || !this.room) return;

    const seenIds = new Set<string>();
    serverPlayers.forEach((sPlayer: any, sessionId: string) => {
      seenIds.add(sessionId);
      let localPlayer = this.localState!.players.find(p => p.id === sessionId);

      if (!localPlayer) {
        localPlayer = {
          id: sessionId,
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
          lastHitTime: 0,
          lastEatTime: 0,
          matchStuckTime: 0,
          ring3LowMatchTime: 0,
          emotionTimer: 0,
          acceleration: 1,
          maxSpeed: 1,
          friction: 1,
          isInvulnerable: sPlayer.isInvulnerable,
          skillCooldown: sPlayer.skillCooldown,
          maxSkillCooldown: 5,
          defense: 1,
          damageMultiplier: 1,
          critChance: 0,
          critMultiplier: 1,
          lifesteal: 0,
          armorPen: 0,
          reflectDamage: 0,
          visionMultiplier: 1,
          sizePenaltyMultiplier: 1,
          skillCooldownMultiplier: 1,
          skillPowerMultiplier: 1,
          skillDashMultiplier: 1,
          killGrowthMultiplier: 1,
          poisonOnHit: false,
          doubleCast: false,
          reviveAvailable: false,
          magneticFieldRadius: 0,
          mutationCooldowns: {
            speedSurge: 0,
            invulnerable: 0,
            rewind: 0,
            lightning: 0,
            chaos: 0,
            kingForm: 0
          },
          rewindHistory: [],
          stationaryTime: 0,
          statusEffects: { ...sPlayer.statusEffects }
        } as unknown as Player;
        this.localState!.players.push(localPlayer);
      }

      localPlayer.score = sPlayer.score;
      localPlayer.currentHealth = sPlayer.currentHealth;
      localPlayer.kills = sPlayer.kills;
      localPlayer.matchPercent = sPlayer.matchPercent;
      localPlayer.ring = sPlayer.ring;
      localPlayer.emotion = sPlayer.emotion as Emotion;
      localPlayer.isDead = sPlayer.isDead;
      localPlayer.radius = sPlayer.radius;

      if (sessionId === this.room?.sessionId) {
        const lastProcessed = sPlayer.lastProcessedInput || 0;
        this.pendingInputs = this.pendingInputs.filter(input => input.seq > lastProcessed);
        this.localState!.player = localPlayer;
      } else {
        localPlayer.velocity.x = sPlayer.velocity.x;
        localPlayer.velocity.y = sPlayer.velocity.y;
      }
    });

    this.localState.players = this.localState.players.filter(p => seenIds.has(p.id) || p.isDead);
  }

  private syncBots(serverBots: any) {
    if (!this.localState) return;

    const seenIds = new Set<string>();

    serverBots.forEach((sBot: any, id: string) => {
      seenIds.add(id);
      let localBot = this.localState!.bots.find(b => b.id === id);

      if (!localBot) {
        // Create new
        localBot = {
          id: sBot.id,
          position: { x: sBot.position.x, y: sBot.position.y },
          velocity: { x: sBot.velocity.x, y: sBot.velocity.y },
          radius: sBot.radius,
          color: '#fff', // Recalc from pigment later
          isDead: sBot.isDead,
          trail: [],
          name: sBot.name,
          score: sBot.score,
          kills: sBot.kills,
          maxHealth: sBot.maxHealth,
          currentHealth: sBot.currentHealth,
          // ... defaults
          pigment: { r: sBot.pigment.r, g: sBot.pigment.g, b: sBot.pigment.b },
          targetPigment: { r: sBot.targetPigment.r, g: sBot.targetPigment.g, b: sBot.targetPigment.b },
          matchPercent: sBot.matchPercent,
          ring: sBot.ring,
          emotion: sBot.emotion,
          shape: sBot.shape,
          statusEffects: { ...sBot.statusEffects }, // Simplified copy
          aiState: 'wander',
          personality: 'farmer',
          targetEntityId: null,
          aiReactionTimer: 0,
          tattoos: [],
          tier: 0 as any, // fixme
          isInvulnerable: false
          // fill rest with defaults
        } as unknown as Bot; // Force cast for MVP quick sync

        this.localState!.bots.push(localBot);
      }

      // Update properties
      localBot.velocity.x = sBot.velocity.x;
      localBot.velocity.y = sBot.velocity.y;
      localBot.currentHealth = sBot.currentHealth;
      localBot.isDead = sBot.isDead;
      localBot.pigment = sBot.pigment;
      localBot.emotion = sBot.emotion;
      localBot.radius = sBot.radius;
      // ... more props
    });

    // Remove stale
    this.localState.bots = this.localState.bots.filter(b => seenIds.has(b.id) || b.isDead); // Keep dead?
  }

  private syncFood(serverFood: any) {
    if (!this.localState) return;

    const seenIds = new Set<string>();

    serverFood.forEach((sFood: any, id: string) => {
      seenIds.add(id);
      let localFood = this.localState!.food.find(f => f.id === id);

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
        this.localState!.food.push(localFood);
      }

      if (sFood.isDead) localFood.isDead = true;
      localFood.radius = sFood.radius;
      localFood.kind = sFood.kind as PickupKind;
      localFood.pigment = { r: sFood.pigment.r, g: sFood.pigment.g, b: sFood.pigment.b };
    });

    // Cleanup
    this.localState.food = this.localState.food.filter(f => seenIds.has(f.id));
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

    if (this.snapshots.length >= 2) {
      const [older, newer] = this.snapshots;
      const span = newer.time - older.time;
      const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - older.time) / span)) : 1;
      this.applyInterpolatedSnapshot(state, older, newer, t);
    } else {
      this.applySnapshot(state, this.snapshots[0]);
    }
  }

  private applyInterpolatedSnapshot(
    state: GameState,
    older: NetworkSnapshot,
    newer: NetworkSnapshot,
    t: number
  ) {
    this.applyEntityInterpolation(state.players, older.players, newer.players, t);
    this.applyEntityInterpolation(state.bots, older.bots, newer.bots, t);
    this.applyFoodInterpolation(state.food, older.food, newer.food, t);
  }

  private applySnapshot(state: GameState, snapshot: NetworkSnapshot) {
    this.applyEntitySnapshot(state.players, snapshot.players);
    this.applyEntitySnapshot(state.bots, snapshot.bots);
    this.applyFoodSnapshot(state.food, snapshot.food);
  }

  private applyEntitySnapshot(entities: Array<Player | Bot>, snapshot: Map<string, EntitySnapshot>) {
    const byId = new Map<string, Player | Bot>(entities.map(e => [e.id, e]));
    snapshot.forEach((data, id) => {
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
    t: number
  ) {
    const byId = new Map<string, Player | Bot>(entities.map(e => [e.id, e]));
    newer.forEach((next, id) => {
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

  sendInput(target: Vector2, inputs: { space: boolean; w: boolean }) {
    if (!this.room) return;
    const seq = ++this.inputSeq;
    this.pendingInputs.push({ seq, target: { ...target }, inputs: { ...inputs } });
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
