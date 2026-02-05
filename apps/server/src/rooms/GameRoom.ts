/**
 * CJR MULTIPLAYER GAME ROOM
 * Authoritative server implementation using Colyseus
 */

import { Room } from 'colyseus';
import type { Client, Delayed } from 'colyseus';
import { logger } from '../logging/Logger';
import {
  GameRoomState,
  PlayerState,
  BotState,
} from '../schema/GameState';
import {
  MAP_RADIUS,
  PLAYER_START_RADIUS,
} from '../constants';

// Import shared game logic
import { BinaryPacker } from '@cjr/engine/networking';
import {
  PhysicsSystem,
  MovementSystem,
  SkillSystem,
  TransformStore,
  PhysicsStore,
  StateStore,
  InputStore,
  StatsStore,
  ConfigStore,
  checkRingTransition,
  calcMatchPercentFast,
} from '@cjr/engine';
import { EntityFlags, MAX_ENTITIES } from '@cjr/engine/dod/EntityFlags';

// Import security validation
import { serverValidator } from '../security/ServerValidator';
import { InputValidator } from '../validation/InputValidator';

// Server Engine Bridge
import { ServerEngineBridge } from '../engine/ServerEngineBridge';

export class GameRoom extends Room<GameRoomState> {
  maxClients = 50;
  private gameLoop!: Delayed;
  private serverEngine!: ServerEngineBridge;
  private inputsBySession: Map<
    string,
    { seq: number; targetX: number; targetY: number; space: boolean; w: boolean }
  > = new Map();

  // EIDOLON-V: DOD Entity mapping (sessionId -> entityIndex)
  private entityIndices: Map<string, number> = new Map();
  // EIDOLON-V BOT DOD: Bot entity mapping (botId -> entityIndex)
  private botEntityIndices: Map<string, number> = new Map();
  private nextEntityIndex: number = 0;
  // EIDOLON-V P0: Entity pool recycling with generation for safe ID reuse
  private freeEntityIndices: number[] = [];
  private entityGenerations: Uint16Array = new Uint16Array(MAX_ENTITIES);

  // Security & Physics constants
  private static readonly SECURITY_MAX_DT_SEC = 0.2;
  private static readonly MAX_SPEED_BASE = 150;
  private static readonly SPEED_VALIDATION_TOLERANCE = 1.15; // 15% tolerance
  private lastUpdateDtSec = 1 / 60;

  // EIDOLON-V: WebSocket Rate Limiting
  private clientRates: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 1000;
  private readonly RATE_LIMIT_MAX = 60;

  // EIDOLON-V P0 SECURITY: Entity handle validation to prevent ABA problem
  // Composite handle: (generation << 16) | index
  private makeEntityHandle(index: number): number {
    const gen = this.entityGenerations[index];
    return (gen << 16) | index;
  }

  // Validate entity handle is still valid (not recycled)
  private isValidEntityHandle(handle: number): boolean {
    const index = handle & 0xFFFF;
    const expectedGen = handle >> 16;

    if (index < 0 || index >= MAX_ENTITIES) return false;

    const currentGen = this.entityGenerations[index];
    return currentGen === expectedGen;
  }

  // Extract index from handle (only if valid)
  private getIndexFromHandle(handle: number): number | null {
    if (!this.isValidEntityHandle(handle)) return null;
    return handle & 0xFFFF;
  }

  onCreate(options: unknown) {
    logger.info('GameRoom created!', { options });

    // EIDOLON-V PHASE1: Validate room creation options
    const roomValidation = InputValidator.validateRoomOptions(options);
    if (!roomValidation.isValid) {
      logger.warn(`Invalid room options: ${roomValidation.errors.join(', ')}`);
      throw new Error(`Invalid room options: ${roomValidation.errors.join(', ')}`);
    }

    this.setState(new GameRoomState());

    this.serverEngine = new ServerEngineBridge();

    this.onMessage('input', (client, message: unknown) => {
      // EIDOLON-V P7: Message type and size validation
      if (!message || typeof message !== 'object') {
        logger.warn(`Invalid message type from ${client.sessionId}`, { type: typeof message });
        return;
      }

      // EIDOLON-V P7: Max payload size check (prevent DoS via large messages)
      const messageSize = JSON.stringify(message).length;
      const MAX_MESSAGE_SIZE = 1024; // 1KB max
      if (messageSize > MAX_MESSAGE_SIZE) {
        logger.warn(`Message too large from ${client.sessionId}`, { size: messageSize, max: MAX_MESSAGE_SIZE });
        return;
      }

      // EIDOLON-V PHASE1: Rate Limit Check
      const now = Date.now();
      let rate = this.clientRates.get(client.sessionId);
      if (!rate || now > rate.resetTime) {
        rate = { count: 0, resetTime: now + this.RATE_LIMIT_WINDOW };
        this.clientRates.set(client.sessionId, rate);
      }
      rate.count++;

      if (rate.count > this.RATE_LIMIT_MAX) {
        // Log sparingly (every 20 dropped frames) to avoid polluting logs
        if (rate.count % 20 === 0) {
          logger.warn(`Rate limit exceeded for ${client.sessionId}`, { count: rate.count });
        }
        return;
      }

      // EIDOLON-V PHASE1: Validate input before processing
      const inputValidation = InputValidator.validateGameInput(message);
      if (!inputValidation.isValid) {
        logger.warn(`Invalid input from ${client.sessionId}`, { errors: inputValidation.errors });
        return; // Silently drop invalid input
      }

      // EIDOLON-V P0: Never use unsafe fallback
      if (!inputValidation.sanitized) return;
      const sanitizedInput = inputValidation.sanitized as {
        seq?: number; targetX?: number; targetY?: number; space?: boolean; w?: boolean
      };

      this.inputsBySession.set(client.sessionId, {
        seq: sanitizedInput.seq || 0,
        targetX: sanitizedInput.targetX ?? 0,
        targetY: sanitizedInput.targetY ?? 0,
        space: !!sanitizedInput.space,
        w: !!sanitizedInput.w,
      });
    });
  }

  onJoin(client: Client, options: { name?: string; shape?: string; pigment?: { r: number; g: number; b: number } }) {
    logger.info('Client joined', { sessionId: client.sessionId, options });

    // Validate player options
    const playerValidation = InputValidator.validatePlayerOptions(options);
    let validOptions: { name?: string; shape?: string } = {};

    if (!playerValidation.isValid) {
      logger.warn(`Invalid player options from ${client.sessionId}`, {
        errors: playerValidation.errors,
      });
    } else {
      validOptions = playerValidation.sanitized || {};
    }

    // EIDOLON-V P0: Allocate DOD entity index with recycling
    const entityIndex = this.allocateEntityIndex();
    if (entityIndex === -1) {
      logger.error('Entity pool exhausted - cannot add player', { sessionId: client.sessionId });
      client.leave();
      return;
    }
    this.entityIndices.set(client.sessionId, entityIndex);

    // Create Colyseus state
    const player = new PlayerState();
    player.id = client.sessionId;
    player.sessionId = client.sessionId;
    player.name = validOptions.name || `Jelly ${client.sessionId.slice(0, 4)}`;
    player.shape = validOptions.shape || 'circle';

    // Random Position (outer ring)
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (MAP_RADIUS * 0.8);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    player.position.x = x;
    player.position.y = y;

    // Pigment setup
    if (options?.pigment?.r !== undefined) {
      player.pigment.r = Math.max(0, Math.min(1, options.pigment.r));
      player.pigment.g = Math.max(0, Math.min(1, options.pigment.g));
      player.pigment.b = Math.max(0, Math.min(1, options.pigment.b));
    } else {
      player.pigment.r = Math.random();
      player.pigment.g = Math.random();
      player.pigment.b = Math.random();
    }

    // Target Pigment (Quest color)
    player.targetPigment.r = Math.random();
    player.targetPigment.g = Math.random();
    player.targetPigment.b = Math.random();

    // Calculate initial match percent
    player.matchPercent = calcMatchPercentFast(
      { r: player.pigment.r, g: player.pigment.g, b: player.pigment.b },
      { r: player.targetPigment.r, g: player.targetPigment.g, b: player.targetPigment.b }
    );

    this.state.players.set(client.sessionId, player);

    // Initialize DOD Component Stores
    // Transform: [x, y, rotation, scale, prevX, prevY, prevRotation, _pad]
    TransformStore.set(entityIndex, x, y, angle, 1.0);

    // Physics: [vx, vy, vRotation, mass, radius, restitution, friction, _pad]
    const mass = Math.PI * PLAYER_START_RADIUS * PLAYER_START_RADIUS;
    PhysicsStore.set(entityIndex, 0, 0, mass, PLAYER_START_RADIUS, 0.5, 0.93);

    // Stats: [currentHealth, maxHealth, score, matchPercent, defense, damageMultiplier, _pad, _pad]
    StatsStore.set(entityIndex, 100, 100, 0, player.matchPercent, 1, 1);

    // Input: [targetX, targetY, isSkillActive, isEjectActive]
    InputStore.setTarget(entityIndex, x, y);

    // Config: [maxSpeed, speedMultiplier, magnetRadius, _pad]
    ConfigStore.setMaxSpeed(entityIndex, GameRoom.MAX_SPEED_BASE);
    ConfigStore.setSpeedMultiplier(entityIndex, 1.0);

    // Activate entity
    StateStore.setFlag(entityIndex, EntityFlags.ACTIVE);

    // Add to engine bridge for high-level logic
    this.serverEngine.addPlayer(client.sessionId, player.name, player.shape);

    logger.info('Player added to DOD engine', {
      sessionId: client.sessionId,
      entityIndex,
      position: { x, y },
      matchPercent: player.matchPercent.toFixed(2),
    });
  }

  onLeave(client: Client, consented: boolean) {
    logger.info('Client left', { sessionId: client.sessionId, consented });

    // Cleanup Rate Limiter
    this.clientRates.delete(client.sessionId);

    // EIDOLON-V P0: Cleanup DOD entity with proper release
    const entityIndex = this.entityIndices.get(client.sessionId);
    if (entityIndex !== undefined) {
      this.releaseEntityIndex(entityIndex);
      this.entityIndices.delete(client.sessionId);
    }

    // Remove from engine bridge
    this.serverEngine.removePlayer(client.sessionId);

    // Remove from Colyseus state
    this.state.players.delete(client.sessionId);
    this.inputsBySession.delete(client.sessionId);
  }

  onDispose() {
    logger.info('Room disposed');
    // Clean up security validator
    serverValidator.cleanup();
  }

  update(dt: number) {
    const dtSec = Math.min(dt / 1000, GameRoom.SECURITY_MAX_DT_SEC);
    this.lastUpdateDtSec = dtSec;

    // 1. Apply client inputs to DOD InputStore
    this.applyInputsToDOD();

    // 2. Run DOD Physics Systems
    PhysicsSystem.update(dtSec);
    MovementSystem.updateAll(dtSec);
    SkillSystem.update(dtSec);

    // 3. Update Ring Logic (CJR specific)
    this.updateRingLogicForAll();

    // EIDOLON-V P2: 3.5 Check for player deaths
    this.checkPlayerDeaths();

    // 4. Sync DOD stores back to Colyseus schema
    this.syncDODToSchema();

    // 5. Update game time
    this.state.gameTime += dtSec;

    // 6. Broadcast binary transforms
    this.broadcastBinaryTransforms();
  }

  private applyInputsToDOD() {
    this.state.players.forEach((player, sessionId) => {
      const entityIndex = this.entityIndices.get(sessionId);
      if (entityIndex === undefined) return;

      // EIDOLON-V FIX: Atomic input consumption - get and delete immediately
      // Prevents race condition where input gets overwritten mid-processing
      const input = this.inputsBySession.get(sessionId);
      if (!input) return;
      this.inputsBySession.delete(sessionId); // Consume immediately

      // Validate and clamp target position (anti-cheat)
      const clampedX = Math.max(-MAP_RADIUS, Math.min(MAP_RADIUS, input.targetX));
      const clampedY = Math.max(-MAP_RADIUS, Math.min(MAP_RADIUS, input.targetY));

      // Apply to DOD InputStore
      InputStore.setTarget(entityIndex, clampedX, clampedY);

      // Handle skill input
      if (input.space) {
        InputStore.setAction(entityIndex, 0, true); // Bit 0 = Primary/Skill
      }
      if (input.w) {
        InputStore.setAction(entityIndex, 1, true); // Bit 1 = Secondary/Eject
      }

      // Mark input as processed
      player.lastProcessedInput = input.seq;
    });
  }

  private updateRingLogicForAll() {
    this.state.players.forEach((player, sessionId) => {
      const entityIndex = this.entityIndices.get(sessionId);
      if (entityIndex === undefined || player.isDead) return;

      // Build ring entity interface
      const ringEntity = {
        physicsIndex: entityIndex,
        position: {
          x: TransformStore.getX(entityIndex),
          y: TransformStore.getY(entityIndex),
        },
        velocity: {
          x: PhysicsStore.getVelocityX(entityIndex),
          y: PhysicsStore.getVelocityY(entityIndex),
        },
        ring: player.ring as 1 | 2 | 3,
        matchPercent: player.matchPercent,
        isDead: player.isDead,
        statusScalars: {},
        statusMultipliers: {},
        statusTimers: {},
      };

      // Check ring transition
      const result = checkRingTransition(ringEntity);

      if (result.transitioned && result.newRing) {
        player.ring = result.newRing;
        logger.info('Player committed to deeper ring', {
          sessionId,
          fromRing: ringEntity.ring,
          toRing: result.newRing,
          matchPercent: player.matchPercent.toFixed(2),
        });
      }

      // Sync position/velocity back from ring logic
      if (ringEntity.physicsIndex !== undefined) {
        TransformStore.setPosition(entityIndex, ringEntity.position.x, ringEntity.position.y);
        PhysicsStore.setVelocity(entityIndex, ringEntity.velocity.x, ringEntity.velocity.y);
      }
    });
  }

  /**
   * IMPERATOR Phase 2: syncDODToSchema
   * 
   * TODO: This method will be reduced to only binary packing
   * once GameRoomState fully implements IEngineGameState and
   * ServerEngineBridge.syncDODToEngineState is activated.
   * 
   * For now, maintains backward compatibility with direct property writes.
   */
  private syncDODToSchema() {
    this.state.players.forEach((player, sessionId) => {
      const entityIndex = this.entityIndices.get(sessionId);
      if (entityIndex === undefined) return;

      // Check if entity is still active
      if (!StateStore.isActive(entityIndex)) {
        if (!player.isDead) {
          player.isDead = true;
        }
        return;
      }

      // Sync Transform -> Schema position
      player.position.x = TransformStore.getX(entityIndex);
      player.position.y = TransformStore.getY(entityIndex);

      // Sync Physics -> Schema velocity
      player.velocity.x = PhysicsStore.getVelocityX(entityIndex);
      player.velocity.y = PhysicsStore.getVelocityY(entityIndex);

      // Update radius from physics store
      player.radius = PhysicsStore.getRadius(entityIndex);

      // Server-side speed validation (anti-cheat)
      const vx = player.velocity.x;
      const vy = player.velocity.y;
      const speed = Math.sqrt(vx * vx + vy * vy);
      const maxSpeed = GameRoom.MAX_SPEED_BASE * GameRoom.SPEED_VALIDATION_TOLERANCE;

      if (speed > maxSpeed) {
        // Log potential speed hack
        logger.warn('Speed validation failed', {
          sessionId,
          speed: speed.toFixed(2),
          maxAllowed: maxSpeed.toFixed(2),
        });

        // Clamp velocity
        const scale = maxSpeed / speed;
        player.velocity.x *= scale;
        player.velocity.y *= scale;
        PhysicsStore.setVelocity(entityIndex, player.velocity.x, player.velocity.y);
      }
    });
  }

  private broadcastBinaryTransforms() {
    // EIDOLON-V BOT DOD: Unified indexed transforms for ALL entities (players + bots)
    const indexedUpdates: { index: number; x: number; y: number; vx: number; vy: number }[] = [];

    // Gather player transforms from DOD stores (authoritative)
    this.state.players.forEach((player, sessionId) => {
      const entityIndex = this.entityIndices.get(sessionId);
      if (entityIndex === undefined) return;
      if (!StateStore.isActive(entityIndex)) return;

      indexedUpdates.push({
        index: entityIndex,
        x: TransformStore.getX(entityIndex),
        y: TransformStore.getY(entityIndex),
        vx: PhysicsStore.getVelocityX(entityIndex),
        vy: PhysicsStore.getVelocityY(entityIndex),
      });
    });

    // EIDOLON-V BOT DOD: Bots now use indexed format (unified with players)
    this.state.bots.forEach((bot, botId) => {
      const entityIndex = this.botEntityIndices.get(botId);
      if (entityIndex === undefined) return;
      if (!StateStore.isActive(entityIndex)) return;

      indexedUpdates.push({
        index: entityIndex,
        x: TransformStore.getX(entityIndex),
        y: TransformStore.getY(entityIndex),
        vx: PhysicsStore.getVelocityX(entityIndex),
        vy: PhysicsStore.getVelocityY(entityIndex),
      });
    });

    // Single unified broadcast (players + bots together)
    if (indexedUpdates.length > 0) {
      const buffer = BinaryPacker.packTransformsIndexed(indexedUpdates, this.state.gameTime);
      this.broadcast('binIdx', new Uint8Array(buffer));
    }
  }


  // EIDOLON-V P0: Allocate entity index with recycling
  private allocateEntityIndex(): number {
    // Prefer recycled indices
    if (this.freeEntityIndices.length > 0) {
      const idx = this.freeEntityIndices.pop();
      if (idx === undefined) {
        // This should never happen due to length check, but satisfies type safety
        return -1;
      }
      this.entityGenerations[idx]++;  // Increment generation on reuse
      return idx;
    }

    // Allocate new index if pool not exhausted
    if (this.nextEntityIndex >= MAX_ENTITIES) {
      return -1;  // Pool exhausted
    }

    return this.nextEntityIndex++;
  }

  // EIDOLON-V P0: Release entity index for recycling with DOD store cleanup
  private releaseEntityIndex(idx: number): void {
    // Zero ALL DOD stores to prevent stale data reads
    const stride8 = idx * 8;
    TransformStore.data.fill(0, stride8, stride8 + 8);
    PhysicsStore.data.fill(0, stride8, stride8 + 8);
    StatsStore.data.fill(0, stride8, stride8 + 8);
    StateStore.flags[idx] = 0;
    InputStore.data.fill(0, idx * 4, idx * 4 + 4);
    ConfigStore.data.fill(0, idx * 4, idx * 4 + 4);

    // Return to free list
    this.freeEntityIndices.push(idx);
  }

  // EIDOLON-V BOT DOD: Spawn a bot with DOD entity allocation
  // Returns entityIndex on success, -1 on failure (pool exhausted)
  spawnBot(
    botId: string,
    x: number,
    y: number,
    name: string = 'Bot',
    personality: string = 'farmer'
  ): number {
    const entityIndex = this.allocateEntityIndex();
    if (entityIndex === -1) {
      logger.error('Cannot spawn bot - entity pool exhausted', { botId });
      return -1;
    }

    // Initialize DOD stores
    TransformStore.set(entityIndex, x, y, 0, 1.0);
    PhysicsStore.set(entityIndex, 0, 0, 100, PLAYER_START_RADIUS);
    StatsStore.set(entityIndex, 100, 100, 0, 0, 1, 1);
    ConfigStore.setMaxSpeed(entityIndex, GameRoom.MAX_SPEED_BASE * 0.8); // Bots slightly slower
    StateStore.setFlag(entityIndex, EntityFlags.ACTIVE);

    this.botEntityIndices.set(botId, entityIndex);

    // Create Colyseus schema state
    const bot = new BotState();
    bot.id = botId;
    bot.name = name;
    bot.personality = personality;
    bot.position.x = x;
    bot.position.y = y;
    bot.radius = PLAYER_START_RADIUS;
    bot.pigment.r = Math.random();
    bot.pigment.g = Math.random();
    bot.pigment.b = Math.random();
    bot.targetPigment.r = Math.random();
    bot.targetPigment.g = Math.random();
    bot.targetPigment.b = Math.random();

    this.state.bots.set(botId, bot);

    logger.info('Bot spawned with DOD', {
      botId,
      entityIndex,
      position: { x, y },
    });

    return entityIndex;
  }

  // EIDOLON-V BOT DOD: Remove a bot with proper DOD cleanup
  removeBot(botId: string): void {
    const entityIndex = this.botEntityIndices.get(botId);
    if (entityIndex !== undefined) {
      this.releaseEntityIndex(entityIndex);
      this.botEntityIndices.delete(botId);
    }
    this.state.bots.delete(botId);
    logger.info('Bot removed', { botId });
  }

  // EIDOLON-V P2: Check all players for death condition
  private checkPlayerDeaths(): void {
    this.state.players.forEach((player, sessionId) => {
      if (player.isDead) return;  // Already dead

      const entityIndex = this.entityIndices.get(sessionId);
      if (entityIndex === undefined) return;

      // Read health from DOD store
      const currentHealth = StatsStore.getCurrentHealth(entityIndex);

      if (currentHealth <= 0) {
        this.handlePlayerDeath(player, sessionId);
      }
    });
  }

  private handlePlayerDeath(player: PlayerState, sessionId: string) {
    const entityIndex = this.entityIndices.get(sessionId);

    // Mark as dead briefly for respawn animation
    player.isDead = true;

    // Respawn after brief delay (synchronous for now)
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (MAP_RADIUS * 0.8);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    player.position.x = x;
    player.position.y = y;
    player.radius = PLAYER_START_RADIUS;
    player.currentHealth = 100;
    player.isDead = false;

    // EIDOLON-V P2: Sync respawn to DOD stores
    if (entityIndex !== undefined) {
      TransformStore.setPosition(entityIndex, x, y);
      PhysicsStore.setVelocity(entityIndex, 0, 0);
      StatsStore.setCurrentHealth(entityIndex, 100);
    }

    logger.info('Player respawned', { sessionId, position: { x, y } });
  }
}
