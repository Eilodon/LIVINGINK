
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

export class NetworkClient {
  private config: NetworkConfig;
  private room: Room | null = null;
  private client: Colyseus.Client;

  // Local GameState reference to sync into
  private localState: GameState | null = null;

  constructor(config: Partial<NetworkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new Colyseus.Client(this.config.serverUrl);
  }

  setLocalState(state: GameState) {
    this.localState = state;
  }

  async connect(playerName: string, shape: ShapeId): Promise<boolean> {
    try {
      this.room = await this.client.joinOrCreate('game', {
        name: playerName,
        shape: shape
      });
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
  }

  private setupRoomListeners() {
    if (!this.room) return;

    this.room.onStateChange((state: any) => {
      if (!this.localState) return;

      // Sync Players
      state.players.forEach((serverPlayer: any, sessionId: string) => {
        if (sessionId === this.room?.sessionId) {
          // Update Self (mostly specific authoritative data like score, hp, ring, match)
          const p = this.localState!.player;
          p.score = serverPlayer.score;
          p.currentHealth = serverPlayer.currentHealth;
          p.kills = serverPlayer.kills;
          p.matchPercent = serverPlayer.matchPercent;
          p.ring = serverPlayer.ring;
          p.emotion = serverPlayer.emotion as Emotion;

          // We might want to reconcile position? 
          // For now trust client prediction for smooth movement, 
          // but snap if too far? 
          // Ignoring pos sync for self for now.
        } else {
          // Update Other Players (Bots treated as Others in list?)
          // Actually Schema splits Bots and Players.
          // TODO: Handle multiplayer others
        }
      });

      // Sync Bots as array
      // We need to map MapSchema to our Array
      this.syncBots(state.bots); // Bots
      this.syncFood(state.food); // Food
    });
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
      localBot.position.x = sBot.position.x;
      localBot.position.y = sBot.position.y;
      localBot.velocity.x = sBot.velocity.x;
      localBot.velocity.y = sBot.velocity.y;
      localBot.currentHealth = sBot.currentHealth;
      localBot.isDead = sBot.isDead;
      localBot.pigment = sBot.pigment;
      localBot.emotion = sBot.emotion;
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
    });

    // Cleanup
    this.localState.food = this.localState.food.filter(f => seenIds.has(f.id));
  }


  sendInput(target: Vector2, inputs: { space: boolean; w: boolean }) {
    if (!this.room) return;
    this.room.send('input', {
      targetX: target.x,
      targetY: target.y,
      skill: inputs.space,
      eject: inputs.w
    });
  }

  getRoomId() { return this.room?.roomId; }
}

export const networkClient = new NetworkClient();
