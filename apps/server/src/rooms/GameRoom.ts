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
  FoodState,
  PigmentVec3,
} from '../schema/GameState';
import {
  MAP_RADIUS,
  PLAYER_START_RADIUS,
} from '../constants';

// Import shared game logic
import { SchemaBinaryPacker } from '@cjr/engine/networking';
import {
  PhysicsSystem,
  MovementSystem,
  GameConfig,
  SkillSystem,
  TransformStore,
  PhysicsStore,
  StateStore,
  InputStore,
  StatsStore,
  ConfigStore,
  SkillAccess, // EIDOLON-V P1: For server-authoritative cooldown check
  checkRingTransition,
  calcMatchPercentFast,
  updateWaveSpawner,
  WAVE_CONFIG,
  type IFood,
  WorldState, // EIDOLON-V FIX: Removed invalid 'Type' import
} from '@cjr/engine';
// Import EntityFlags from engine root (exported via compat/generated)
import { EntityFlags } from '@cjr/engine';
import { MAX_ENTITIES } from '@cjr/engine';

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
  // EIDOLON-V P5 FIX: Active entity list for O(N) iteration
  private activeEntityIndices: number[] = [];
  private entityGenerations: Uint16Array = new Uint16Array(MAX_ENTITIES);

  // EIDOLON-V P6 FIX: Instance-based WorldState (No Global Singleton)
  private world!: WorldState;

  // Security & Physics constants
  private static readonly SECURITY_MAX_DT_SEC = 0.2;
  private static readonly MAX_SPEED_BASE = 150;
  private static readonly SPEED_VALIDATION_TOLERANCE = 1.15; // 15% tolerance
  private lastUpdateDtSec = 1 / 60;

  // EIDOLON-V P0 SECURITY: Entity pool DoS protection
  private readonly MAX_ENTITIES_PER_CLIENT = 5; // Max bots/entities per client
  private clientEntityCounts: Map<string, number> = new Map();

  // EIDOLON-V: WebSocket Rate Limiting
  private clientRates: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 1000;
  private readonly RATE_LIMIT_MAX = 60;

  // EIDOLON-V P12 SECURITY: Room creation rate limit tracking
  private roomCreateRates = new Map<string, number>(); // IP -> count
  private roomCreateLastReset = new Map<string, number>(); // IP -> timestamp

  // EIDOLON-V FIX: Wave spawner state for food generation
  private waveState = {
    ring1: WAVE_CONFIG.INTERVAL[1],
    ring2: WAVE_CONFIG.INTERVAL[2],
    ring3: WAVE_CONFIG.INTERVAL[3],
  };
  private nextFoodId: number = 0;

  // EIDOLON-V P0 SECURITY: Entity handle validation to prevent ABA problem
  // Composite handle: (generation << 16) | index
  private entityHandleMap = new Map<string, number>(); // sessionId -> composite handle

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

  // EIDOLON-V FIX: Rate limiting for room creation/joining
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async onAuth(client: Client, options: unknown, request?: any): Promise<boolean> {
    // EIDOLON-V P12 SECURITY: Room creation rate limiting to prevent DoS
    // EIDOLON-V FIX: IP Spoofing protection - Prefer remoteAddress unless TRUST_PROXY is set
    let clientIp = 'unknown';

    if (process.env.TRUST_PROXY === 'true') {
      // Trust headers only if explicitly configured
      clientIp = (request?.headers?.['x-forwarded-for'] as string) ||
        (request?.headers?.['x-real-ip'] as string) ||
        request?.socket?.remoteAddress ||
        'unknown';
    } else {
      // Direct connection (no proxy trusted)
      clientIp = request?.socket?.remoteAddress || 'unknown';
    }

    const now = Date.now();
    const rateKey = `room_create:${clientIp}`;
    const windowMs = 60000; // 1 minute window
    const maxRequests = 5;  // Max 5 rooms per minute per IP

    // Get current count for this IP
    const currentCount = this.roomCreateRates.get(rateKey) || 0;

    // Check if window expired and reset
    const lastReset = this.roomCreateLastReset.get(rateKey) || 0;
    if (now - lastReset > windowMs) {
      this.roomCreateRates.set(rateKey, 1);
      this.roomCreateLastReset.set(rateKey, now);
      return true;
    }

    if (currentCount >= maxRequests) {
      logger.warn('Room creation rate limit exceeded', {
        clientIp: clientIp.slice(0, 7), // Log partial IP for privacy
        currentCount,
        maxRequests,
      });
      return false; // Reject connection
    }

    // Increment counter
    this.roomCreateRates.set(rateKey, currentCount + 1);
    return true;
  }

  onCreate(options: unknown) {
    logger.info('GameRoom created!', { options });

    // EIDOLON-V P6 FIX: Instantiate WorldState per room
    this.world = new WorldState();

    // EIDOLON-V P4 FIX: Periodic Cleanup Interval
    this.clock.setInterval(() => {
      serverValidator.cleanup();
    }, 60000); // Every 1 minute

    // EIDOLON-V PHASE1: Validate room creation options
    const roomValidation = InputValidator.validateRoomOptions(options);
    if (!roomValidation.isValid) {
      logger.warn(`Invalid room options: ${roomValidation.errors.join(', ')}`);
      throw new Error(`Invalid room options: ${roomValidation.errors.join(', ')}`);
    }

    this.setState(new GameRoomState());

    // EIDOLON-V P6 FIX: Pass instance world to ServerEngineBridge
    this.serverEngine = new ServerEngineBridge(this.world);

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

    // EIDOLON-V P9 FIX: Store entity handle for validation
    this.entityHandleMap.set(client.sessionId, this.makeEntityHandle(entityIndex));

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

    // EIDOLON-V P0 SECURITY: Cleanup entity count tracking
    this.clientEntityCounts.delete(client.sessionId);

    // EIDOLON-V P9 FIX: Cleanup entity handle
    this.entityHandleMap.delete(client.sessionId);

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
    // EIDOLON-V FIX: Correct order - Movement THEN Physics
    // MovementSystem converts input targets to velocities
    // PhysicsSystem integrates velocity to position + applies friction

    // EIDOLON-V P6 FIX: Pass instance world
    MovementSystem.updateAll(this.world, dtSec);

    // EIDOLON-V P5 FIX: Pass active indices for O(N) iteration
    PhysicsSystem.update(this.world, dtSec, this.activeEntityIndices);

    SkillSystem.update(dtSec, this.world);

    // 3. Update Ring Logic (CJR specific)
    this.updateRingLogicForAll();

    // EIDOLON-V P2: 3.5 Check for player deaths
    this.checkPlayerDeaths();

    // EIDOLON-V FIX: 3.6 Wave Spawner - Generate food
    this.updateFoodSpawning(dtSec);

    // 4. Update game time
    this.state.gameTime += dtSec;

    // 5. Broadcast binary transforms
    this.broadcastBinaryTransforms();
  }

  private applyInputsToDOD() {
    this.state.players.forEach((player, sessionId) => {
      const entityIndex = this.entityIndices.get(sessionId);
      if (entityIndex === undefined) return;

      // EIDOLON-V P9 SECURITY: Validate entity handle before processing
      // Prevents ABA problem: entity recycled and assigned to different player
      const storedHandle = this.entityHandleMap.get(sessionId);
      if (storedHandle === undefined || !this.isValidEntityHandle(storedHandle)) {
        // Only log warning if not just starting up (handle 0)
        if (storedHandle !== undefined) {
          logger.warn('Invalid entity handle caught (ABA Guard)', { sessionId, storedHandle });
        }
        return; // Drop input
      }

      // Verify handle matches current index
      const currentHandle = this.makeEntityHandle(entityIndex);
      if (storedHandle !== currentHandle) {
        // This is normal during respawns, so use DEBUG log instead of WARN
        logger.debug('Entity handle updated (Respawn/Recycle)', { sessionId, old: storedHandle, new: currentHandle });

        // Update handle map so next frame inputs work
        this.entityHandleMap.set(sessionId, currentHandle);
        return; // EIDOLON-V SEQ: Drop this frame's input as it targets the dead entity
      }

      // EIDOLON-V FIX: Atomic input consumption - get and delete immediately
      // Prevents race condition where input gets overwritten mid-processing
      const input = this.inputsBySession.get(sessionId);
      if (!input) return;
      this.inputsBySession.delete(sessionId); // Consume immediately

      // EIDOLON-V FIX: Sequence number overflow protection
      // Normalize seq to prevent overflow after ~100 hours of continuous play
      const normalizedSeq = input.seq % 0x7FFFFFFF;

      // Validate and clamp target position (anti-cheat)
      const clampedX = Math.max(-MAP_RADIUS, Math.min(MAP_RADIUS, input.targetX));
      const clampedY = Math.max(-MAP_RADIUS, Math.min(MAP_RADIUS, input.targetY));

      // Apply to DOD InputStore
      InputStore.setTarget(entityIndex, clampedX, clampedY);

      // Handle skill input with server-authoritative cooldown check
      if (input.space) {
        // EIDOLON-V P1 SECURITY: Check cooldown from DOD store (not Colyseus schema)
        const currentCooldown = SkillAccess.getCooldown(this.world, entityIndex);
        if (currentCooldown <= 0) {
          InputStore.setAction(entityIndex, 0, true); // Bit 0 = Primary/Skill
        } else {
          logger.debug('Skill input rejected - cooldown active', {
            sessionId,
            cooldown: currentCooldown.toFixed(2),
          });
        }
      }
      if (input.w) {
        InputStore.setAction(entityIndex, 1, true); // Bit 1 = Secondary/Eject
      }

      // Mark input as processed using normalized sequence
      player.lastProcessedInput = normalizedSeq;
    });
  }

  /**
   * Update ring transition logic for all players
   */
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

  private broadcastBinaryTransforms() {
    // EIDOLON-V: Unified Snapshot using SchemaBinaryPacker (SSOT from WorldState)
    // Replaces manual loop over players/bots with zero-overhead iteration
    const buffer = SchemaBinaryPacker.packTransformSnapshot(this.world, this.state.gameTime);

    if (buffer.byteLength > 0) {
      // Use 'binary' channel if client supports it, or 'binIdx' as legacy?
      // Client NetworkClient.ts: handleBinaryIndexedUpdate uses SchemaBinaryUnpacker now.
      // We can use 'binIdx' to keep routing same.
      // But wait: 'binary' message type might be handled differently?
      // Client: this.room.onMessage('binIdx', ...) => handleBinaryIndexedUpdate
      // handleBinaryIndexedUpdate => calls handleBinaryUpdate => unpacks Schema.
      // So 'binIdx' is fine.
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
      this.activeEntityIndices.push(idx);
      return idx;
    }

    // Allocate new index if pool not exhausted
    if (this.nextEntityIndex >= MAX_ENTITIES) {
      return -1;  // Pool exhausted
    }

    const idx = this.nextEntityIndex++;
    this.activeEntityIndices.push(idx);
    return idx;
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

    // EIDOLON-V P5 FIX: Remove from active list (swap-remove O(1))
    const listIndex = this.activeEntityIndices.indexOf(idx);
    if (listIndex !== -1) {
      const last = this.activeEntityIndices.pop();
      if (last !== undefined && listIndex < this.activeEntityIndices.length) {
        this.activeEntityIndices[listIndex] = last;
      }
    }
  }

  // EIDOLON-V BOT DOD: Spawn a bot with DOD entity allocation
  // Returns entityIndex on success, -1 on failure (pool exhausted or limit reached)
  spawnBot(
    botId: string,
    x: number,
    y: number,
    name: string = 'Bot',
    personality: string = 'farmer',
    ownerSessionId?: string // EIDOLON-V P0: Track owner for DoS protection
  ): number {
    // EIDOLON-V P0 SECURITY: Check per-client entity limit
    if (ownerSessionId) {
      const currentCount = this.clientEntityCounts.get(ownerSessionId) || 0;
      if (currentCount >= this.MAX_ENTITIES_PER_CLIENT) {
        logger.warn('Entity limit exceeded for client', {
          ownerSessionId,
          currentCount,
          max: this.MAX_ENTITIES_PER_CLIENT,
        });
        return -1;
      }
    }

    const entityIndex = this.allocateEntityIndex();
    if (entityIndex === -1) {
      logger.error('Cannot spawn bot - entity pool exhausted', { botId });
      return -1;
    }

    // EIDOLON-V P0 SECURITY: Track entity count for owner
    if (ownerSessionId) {
      const newCount = (this.clientEntityCounts.get(ownerSessionId) || 0) + 1;
      this.clientEntityCounts.set(ownerSessionId, newCount);
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
  removeBot(botId: string, ownerSessionId?: string): void {
    const entityIndex = this.botEntityIndices.get(botId);
    if (entityIndex !== undefined) {
      this.releaseEntityIndex(entityIndex);
      this.botEntityIndices.delete(botId);

      // EIDOLON-V P0 SECURITY: Decrement entity count for owner
      if (ownerSessionId) {
        const currentCount = this.clientEntityCounts.get(ownerSessionId) || 0;
        if (currentCount > 0) {
          this.clientEntityCounts.set(ownerSessionId, currentCount - 1);
        }
      }
    }
    this.state.bots.delete(botId);
    logger.info('Bot removed', { botId });
  }

  // EIDOLON-V FIX: Food spawning integration
  private updateFoodSpawning(dtSec: number): void {
    // Call wave spawner to get new food items
    const spawnResult = updateWaveSpawner(this.waveState, dtSec);

    // Add spawned food to Colyseus state
    for (const food of spawnResult.foods) {
      const foodState = new FoodState();
      foodState.id = `food_${this.nextFoodId++}`;
      foodState.x = food.position.x;
      foodState.y = food.position.y;
      foodState.radius = food.radius;
      foodState.value = food.value;
      foodState.kind = food.kind;
      foodState.isDead = false;

      // Set pigment if available
      if (food.pigment) {
        foodState.pigment.r = food.pigment.r;
        foodState.pigment.g = food.pigment.g;
        foodState.pigment.b = food.pigment.b;
      }

      this.state.food.set(foodState.id, foodState);
    }

    // EIDOLON-V FIX: Optimized Food Culling (No GC thrashing)
    const MAX_FOOD = GameConfig.MEMORY.MAX_FOOD_COUNT;

    if (this.state.food.size > MAX_FOOD) {
      // Remove oldest food items using iterator (avoids Array.from allocation)
      const iterator = this.state.food.keys();
      let removed = 0;
      const target = this.state.food.size - MAX_FOOD;

      while (removed < target) {
        const { value: id, done } = iterator.next();
        if (done) break;
        if (id) {
          this.state.food.delete(id);
          removed++;
        }
      }
    }
  }

  // EIDOLON-V P2: Check all players for death condition and sync death state
  private checkPlayerDeaths(): void {
    this.state.players.forEach((player, sessionId) => {
      const entityIndex = this.entityIndices.get(sessionId);
      if (entityIndex === undefined) return;

      // Check death state from DOD
      const currentHealth = StatsStore.getCurrentHealth(entityIndex);
      const isActive = StateStore.isActive(entityIndex);

      // Sync death state to Colyseus schema
      if (!isActive && !player.isDead) {
        player.isDead = true;
      }

      // Handle actual death event
      if (currentHealth <= 0 && !player.isDead) {
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
