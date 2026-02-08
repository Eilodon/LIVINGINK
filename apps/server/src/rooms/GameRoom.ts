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
  TransformAccess,  // PHASE 3: Migrated from TransformStore
  PhysicsAccess,    // PHASE 3: Migrated from PhysicsStore
  StatsAccess,      // P1 FIX: Migrated from StatsStore
  InputStore,
  ConfigStore,
  StateAccess,      // PHASE 4: Migrated from StateStore
  SkillAccess,
  checkRingTransition,
  calcMatchPercentFast,
  updateWaveSpawner,
  WAVE_CONFIG,
  type IFood,
  WorldState,
} from '@cjr/engine';
// Import EntityFlags from engine root (exported via compat/generated)
import { EntityFlags, DirtyTracker } from '@cjr/engine';
import { MAX_ENTITIES } from '@cjr/engine';

// Import security validation
import { serverValidator } from '../security/ServerValidator';
import { InputValidator } from '../validation/InputValidator';

// Server Engine Bridge
import { ServerEngineBridge } from '../engine/ServerEngineBridge';

// Centralized Configuration
import { GAME_ROOM_CONFIG } from './GameRoomConfig';

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

  // EIDOLON-V P6 FIX: Instance-based WorldState (No Global Singleton)
  private world!: WorldState;

  // EIDOLON-V OPTIMIZATION: Dirty Tracker for Delta Compression
  private dirtyTracker!: DirtyTracker;
  private framesSinceSnapshot = 0;
  private readonly SNAPSHOT_INTERVAL = 60; // Force full snapshot every 1s (60 ticks)

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

  // EIDOLON-V AUDIT FIX: Convert ms to seconds (WAVE_CONFIG.INTERVAL is in ms but update() passes dtSec)
  // Was: 8000/10000/14000 ms used with dt in seconds, causing ~2.3 hour wait before first wave
  private waveState = {
    ring1: WAVE_CONFIG.INTERVAL[1] / 1000,
    ring2: WAVE_CONFIG.INTERVAL[2] / 1000,
    ring3: WAVE_CONFIG.INTERVAL[3] / 1000,
  };
  private nextFoodId: number = 0;

  // EIDOLON-V P0 SECURITY: Entity handle validation to prevent ABA problem
  // Composite handle: (generation << 16) | index
  private entityHandleMap = new Map<string, number>(); // sessionId -> composite handle

  // EIDOLON-V AUDIT FIX: Use unsigned right shift (>>>) to prevent sign bit issues
  // when generation > 32767 (was using signed >> which preserves sign bit)
  private makeEntityHandle(index: number): number {
    const gen = this.entityGenerations[index];
    return ((gen << 16) | index) >>> 0; // Force unsigned 32-bit
  }

  // Validate entity handle is still valid (not recycled)
  private isValidEntityHandle(handle: number): boolean {
    const index = handle & 0xFFFF;
    const expectedGen = (handle >>> 16) & 0xFFFF; // Unsigned shift to extract generation

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
    // EIDOLON-V MEMORY OPTIMIZATION: Limit to 1000 entities per room
    // (50 players + ~500 food + ~100 projectiles + buffer = ~1000)
    // This reduces memory from ~2.3MB to ~230KB per room (90% reduction)
    this.world = new WorldState({ maxEntities: 1000 });
    this.dirtyTracker = new DirtyTracker(1000);

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
      if (messageSize > GAME_ROOM_CONFIG.MAX_MESSAGE_SIZE) {
        logger.warn(`Message too large from ${client.sessionId}`, { size: messageSize, max: GAME_ROOM_CONFIG.MAX_MESSAGE_SIZE });
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
    TransformAccess.set(this.world, entityIndex, x, y, angle, 1.0, x, y, angle);

    // Physics: [vx, vy, vRotation, mass, radius, restitution, friction, _pad]
    const mass = Math.PI * PLAYER_START_RADIUS * PLAYER_START_RADIUS;
    PhysicsAccess.set(this.world, entityIndex, 0, 0, 0, mass, PLAYER_START_RADIUS, 0.5, 0.93);

    // Stats: [currentHealth, maxHealth, score, matchPercent, defense, damageMultiplier, _pad, _pad]
    StatsAccess.set(this.world, entityIndex, 100, 100, 0, player.matchPercent, 1, 1);

    // Input: [targetX, targetY, isSkillActive, isEjectActive]
    InputStore.setTarget(this.world, entityIndex, x, y);

    // Config: [maxSpeed, speedMultiplier, magnetRadius, _pad]
    ConfigStore.setMaxSpeed(this.world, entityIndex, GameRoom.MAX_SPEED_BASE);
    ConfigStore.setSpeedMultiplier(this.world, entityIndex, 1.0);

    // Activate entity
    StateAccess.activate(this.world, entityIndex);

    // Add to engine bridge for high-level logic
    this.serverEngine.addPlayer(client.sessionId, player.name, player.shape);

    // Mark as dirty so it gets sent immediately
    this.dirtyTracker.markDirty(entityIndex, 255);

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
    // MovementSystem converts input targets to velocities
    // PhysicsSystem integrates velocity to position + applies friction

    // EIDOLON-V P6 FIX: Pass instance world
    MovementSystem.updateAll(this.world, dtSec);

    // EIDOLON-V P5 FIX: Pass active indices for O(N) iteration
    // EIDOLON-V OPTIMIZATION: Pass dirtyTracker to mark moving entities
    PhysicsSystem.update(this.world, dtSec, undefined, this.dirtyTracker);

    SkillSystem.update(this.world, dtSec);

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
      InputStore.setTarget(this.world, entityIndex, clampedX, clampedY);

      // Handle skill input with server-authoritative cooldown check
      if (input.space) {
        // EIDOLON-V P1 SECURITY: Check cooldown from DOD store (not Colyseus schema)
        const currentCooldown = SkillAccess.getCooldown(this.world, entityIndex);
        if (currentCooldown <= 0) {
          InputStore.setAction(this.world, entityIndex, 0, true); // Bit 0 = Primary/Skill
        } else {
          logger.debug('Skill input rejected - cooldown active', {
            sessionId,
            cooldown: currentCooldown.toFixed(2),
          });
        }
      }
      if (input.w) {
        InputStore.setAction(this.world, entityIndex, 1, true); // Bit 1 = Secondary/Eject
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

      // EIDOLON-V AUDIT FIX: Recalculate matchPercent every tick (was only set on join,
      // causing ring transitions to use stale value and players stuck in Ring 1)
      player.matchPercent = calcMatchPercentFast(
        { r: player.pigment.r, g: player.pigment.g, b: player.pigment.b },
        { r: player.targetPigment.r, g: player.targetPigment.g, b: player.targetPigment.b }
      );

      // Build ring entity interface
      const ringEntity = {
        physicsIndex: entityIndex,
        position: {
          x: TransformAccess.getX(this.world, entityIndex),
          y: TransformAccess.getY(this.world, entityIndex),
        },
        velocity: {
          x: PhysicsAccess.getVx(this.world, entityIndex),
          y: PhysicsAccess.getVy(this.world, entityIndex),
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
        TransformAccess.setX(this.world, entityIndex, ringEntity.position.x);
        TransformAccess.setY(this.world, entityIndex, ringEntity.position.y);
        PhysicsAccess.setVx(this.world, entityIndex, ringEntity.velocity.x);
        PhysicsAccess.setVy(this.world, entityIndex, ringEntity.velocity.y);
      }
    });
  }

  private broadcastBinaryTransforms() {
    // EIDOLON-V: Unified Snapshot using SchemaBinaryPacker (SSOT from WorldState)
    // Replaces manual loop over players/bots with zero-overhead iteration

    let buffer: ArrayBuffer | null = null;
    this.framesSinceSnapshot++;

    // Force full snapshot periodically to sync drift/new players
    if (this.framesSinceSnapshot >= this.SNAPSHOT_INTERVAL) {
      buffer = SchemaBinaryPacker.packTransformSnapshot(this.world, this.state.gameTime);
      this.framesSinceSnapshot = 0;
      // Reset dirty tracker for transforms since we sent everything
      // Actually we don't clear dirty flags here because we rely on frame age in DirtyTracker
    } else {
      // Delta Compression: Only send changed entities
      buffer = SchemaBinaryPacker.packTransformDeltas(this.world, this.state.gameTime, this.dirtyTracker);
    }

    // Tick dirty tracker to age out old entries
    this.dirtyTracker.tick();

    if (buffer && buffer.byteLength > 0) {
      // EIDOLON-V FIX: Unicast with Ack (Last Processed Input)
      // We must append the 'lastProcessedInput' seq for each client to the packet.
      // Format: [Ack (4 bytes)] + [Snapshot Buffer]
      // Note: Header is handled by Colyseus? No, we use sendBytes.
      // Actually Colyseus 'sendBytes' sends raw buffer with a type code?
      // Colyseus documentation says: room.sendBytes(client, buffer)
      // But we are using 'binIdx' channel via broadcast before.
      // To keep it simple and compatible with how we handle messages:
      // We will construct a new buffer for each client: [Ack(4)] + [Original Buffer]
      // And use `client.send('binIdx', buffer)` (which wraps it) OR `client.sendBytes()`?
      // If we use `broadcast('binIdx', buffer)`, it sends the same buffer to all.
      // We need UNICAST.

      const inputs = this.state.players; // Access player state for lastProcessedInput

      this.clients.forEach(client => {
        const player = inputs.get(client.sessionId);
        const lastAck = player ? player.lastProcessedInput : 0;

        // Construct packet: Ack (4 bytes) + Snapshot
        // We reuse the snapshot buffer, just need to prefix it.
        // Optimization: Double buffer or just new allocation?
        // Allocating small header + copy is fine for 50 clients.
        // Or we can assume Client knows how to strip it.

        // Packet Structure:
        // [Ack (4 bytes - Uint32)] + [Body (Snapshot)]
        const packetSize = 4 + buffer.byteLength;
        const packet = new Uint8Array(packetSize);
        const view = new DataView(packet.buffer);

        view.setUint32(0, lastAck, true);
        packet.set(new Uint8Array(buffer), 4);

        // Send unicast
        client.send('binIdx', packet);
      });
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

    const idx = this.nextEntityIndex++;
    return idx;
  }

  // EIDOLON-V P0: Release entity index for recycling with DOD store cleanup
  private releaseEntityIndex(idx: number): void {
    // Zero ALL DOD stores to prevent stale data reads
    const stride8 = idx * 8;
    // Direct buffer access is faster, but we should use accessors or stores to be safe if possible
    // But Stores don't have bulk clear. We'll rely on the typed arrays being available via this.world.
    this.world.transform.fill(0, stride8, stride8 + 8);
    this.world.physics.fill(0, stride8, stride8 + 8);
    this.world.stats.fill(0, stride8, stride8 + 8);
    StateAccess.setFlag(this.world, idx, 0); // Clear all flags
    this.world.input.fill(0, idx * 4, idx * 4 + 4);
    this.world.config.fill(0, idx * 4, idx * 4 + 4);
    this.world.skill.fill(0, idx * 4, idx * 4 + 4);
    this.world.projectile.fill(0, idx * 4, idx * 4 + 4);
    this.world.tattoo.fill(0, idx * 4, idx * 4 + 4);
    this.world.pigment.fill(0, stride8, stride8 + 8);

    // Return to free list
    this.freeEntityIndices.push(idx);


    // EIDOLON-V P5 FIX: Remove from active list (swap-remove O(1))
    StateAccess.deactivate(this.world, idx);
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
    TransformAccess.set(this.world, entityIndex, x, y, 0, 1.0, x, y, 0);
    PhysicsAccess.set(this.world, entityIndex, 0, 0, 0, 100, PLAYER_START_RADIUS, 0.5, 0.9);
    StatsAccess.set(this.world, entityIndex, 100, 100, 0, 0, 1, 1);
    ConfigStore.setMaxSpeed(this.world, entityIndex, GameRoom.MAX_SPEED_BASE * 0.8); // Bots slightly slower
    StateAccess.activate(this.world, entityIndex);

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
    // Call wave spawner with callback to create new food items
    // This avoids creating intermediate arrays/objects (GC optimization)
    updateWaveSpawner(this.waveState, dtSec, (x, y, kind, pigment) => {
      const foodState = new FoodState();
      foodState.id = `food_${this.nextFoodId++}`;
      foodState.x = x;
      foodState.y = y;

      // Radius and Value logic from waveSpawner's createFood
      foodState.radius = kind === 'pigment' ? 12 : kind === 'neutral' ? 8 : 10;
      foodState.value = kind === 'neutral' ? 5 : 2;

      foodState.kind = kind;
      foodState.isDead = false;

      // Set pigment if available
      if (pigment) {
        foodState.pigment.r = pigment.r;
        foodState.pigment.g = pigment.g;
        foodState.pigment.b = pigment.b;
      }

      this.state.food.set(foodState.id, foodState);
    });

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
      const currentHealth = StatsAccess.getHp(this.world, entityIndex);
      const isActive = StateAccess.isActive(this.world, entityIndex);

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

  // EIDOLON-V AUDIT FIX: Use async delay so client sees isDead=true for death animation
  // Was synchronous (isDead set true then immediately false in same tick - client never saw death)
  private handlePlayerDeath(player: PlayerState, sessionId: string) {
    const entityIndex = this.entityIndices.get(sessionId);

    // Mark as dead - client will see this in the next state patch
    player.isDead = true;

    // Respawn after 1.5 second delay (allows death animation to play on client)
    this.clock.setTimeout(() => {
      // Guard: player may have disconnected during the delay
      if (!this.entityIndices.has(sessionId)) return;

      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * (MAP_RADIUS * 0.8);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;

      player.position.x = x;
      player.position.y = y;
      player.radius = PLAYER_START_RADIUS;
      player.currentHealth = 100;
      player.isDead = false;

      // Sync respawn to DOD stores
      if (entityIndex !== undefined) {
        TransformAccess.setX(this.world, entityIndex, x);
        TransformAccess.setY(this.world, entityIndex, y);
        PhysicsAccess.setVx(this.world, entityIndex, 0);
        PhysicsAccess.setVy(this.world, entityIndex, 0);
        StatsAccess.setHp(this.world, entityIndex, 100);
      }

      logger.info('Player respawned', { sessionId, position: { x, y } });
    }, 1500);
  }
}
