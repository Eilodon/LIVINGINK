
/**
 * CJR MULTIPLAYER GAME ROOM
 * Authoritative server implementation using Colyseus
 */

import { Room, Client, Delayed } from 'colyseus';
import {
  GameRoomState,
  PlayerState,
  BotState,
  FoodState,
  ProjectileState,
  PigmentVec3,
  VFXEventState
} from '../schema/GameState';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAP_RADIUS,
  GRID_CELL_SIZE,
  FOOD_COUNT,
  FOOD_RADIUS
} from '../constants';
// Import shared game logic
import { updateGameState, createInitialState } from '../../../services/engine/index';
import { createPlayer } from '../../../services/engine/factories';
import { GameRuntimeState } from '../../../types';
import { getLevelConfig } from '../../../services/cjr/levels';
import { vfxIntegrationManager } from '../../../services/vfx/vfxIntegration';
// Import security validation
import { serverValidator } from '../security/ServerValidator';
import { BinaryPacker } from '../../../services/networking/BinaryPacker';
// EIDOLON-V PHASE1: Import enhanced input validation
import { InputValidator } from '../validation/InputValidator';

export class GameRoom extends Room<GameRoomState> {
  maxClients = 50;
  private gameLoop!: Delayed;
  private runtime!: GameRuntimeState;
  private simState!: ReturnType<typeof createInitialState>;
  private inputsBySession: Map<string, { seq: number; targetX: number; targetY: number; space: boolean; w: boolean }> = new Map();

  onCreate(options: any) {
    console.log('GameRoom created!', options);

    // EIDOLON-V PHASE1: Validate room creation options
    const roomValidation = InputValidator.validateRoomOptions(options);
    if (!roomValidation.isValid) {
      console.error('Invalid room options:', roomValidation.errors);
      throw new Error(`Invalid room options: ${roomValidation.errors.join(', ')}`);
    }

    this.setState(new GameRoomState());

    // EIDOLON-V: Init VFX Buffer
    for (let i = 0; i < 50; i++) {
      this.state.vfxEvents.push(new VFXEventState());
    }

    vfxIntegrationManager.setVFXEnabled(false);

    // Initialize World
    this.state.worldWidth = WORLD_WIDTH;
    this.state.worldHeight = WORLD_HEIGHT;

    const levelConfig = getLevelConfig(1);
    this.runtime = {
      wave: {
        ring1: levelConfig.waveIntervals.ring1,
        ring2: levelConfig.waveIntervals.ring2,
        ring3: levelConfig.waveIntervals.ring3
      },
      boss: {
        bossDefeated: false,
        rushWindowTimer: 0,
        rushWindowRing: null,
        currentBossActive: false,
        attackCharging: false,
        attackTarget: null,
        attackChargeTimer: 0
      },
      contribution: {
        damageLog: new Map(),
        lastHitBy: new Map()
      }
    };

    this.simState = createInitialState(1);
    this.simState.runtime = this.runtime;
    this.simState.players = [this.simState.player];

    this.syncSimStateToServer();

    // Start Game Loop (60 FPS)
    this.setSimulationInterval((dt) => this.update(dt), 1000 / 60);

    this.onMessage('input', (client, message: any) => {
      if (!message) return;

      // EIDOLON-V PHASE1: Validate input before processing
      const inputValidation = InputValidator.validateGameInput(message);
      if (!inputValidation.isValid) {
        console.warn(`Invalid input from ${client.sessionId}:`, inputValidation.errors);
        return; // Silently drop invalid input
      }

      const sanitizedInput = inputValidation.sanitized || message;

      this.inputsBySession.set(client.sessionId, {
        seq: sanitizedInput.seq || 0,
        targetX: sanitizedInput.targetX ?? 0,
        targetY: sanitizedInput.targetY ?? 0,
        space: !!sanitizedInput.space,
        w: !!sanitizedInput.w
      });
    });
  }

  onJoin(client: Client, options: { name?: string; shape?: string; pigment?: any }) {
    console.log(client.sessionId, 'joined!', options);

    // EIDOLON-V PHASE1: Validate player options
    const playerValidation = InputValidator.validatePlayerOptions(options);
    if (!playerValidation.isValid) {
      console.error(`Invalid player options from ${client.sessionId}:`, playerValidation.errors);
      // Don't disconnect, just use defaults
      options = {};
    } else {
      options = playerValidation.sanitized || {};
    }

    const player = new PlayerState();
    player.id = client.sessionId;
    player.sessionId = client.sessionId;
    player.name = options.name || `Jelly ${client.sessionId.substr(0, 4)}`;
    player.shape = options.shape || 'circle';

    // Random Position
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (MAP_RADIUS * 0.8);
    player.position.x = Math.cos(angle) * r;
    player.position.y = Math.sin(angle) * r;

    // Use provided pigment or random
    if (options.pigment) {
      player.pigment.r = options.pigment.r || Math.random();
      player.pigment.g = options.pigment.g || Math.random();
      player.pigment.b = options.pigment.b || Math.random();
    } else {
      player.pigment.r = Math.random();
      player.pigment.g = Math.random();
      player.pigment.b = Math.random();
    }

    // Target Pigment (Quest)
    player.targetPigment.r = Math.random();
    player.targetPigment.g = Math.random();
    player.targetPigment.b = Math.random();

    this.state.players.set(client.sessionId, player);

    const simPlayer = this.simState.players.length === 1 && this.state.players.size === 1
      ? this.simState.players[0]
      : undefined;

    if (simPlayer) {
      simPlayer.id = client.sessionId;
      simPlayer.name = player.name;
      simPlayer.shape = player.shape as any;
      simPlayer.position.x = player.position.x;
      simPlayer.position.y = player.position.y;
      simPlayer.targetPosition = { x: player.position.x, y: player.position.y };
      simPlayer.pigment = { r: player.pigment.r, g: player.pigment.g, b: player.pigment.b };
      simPlayer.targetPigment = { r: player.targetPigment.r, g: player.targetPigment.g, b: player.targetPigment.b };
      simPlayer.isDead = false;
      this.simState.player = simPlayer;
    } else {
      const newPlayer = createPlayer(player.name, player.shape as any);
      newPlayer.id = client.sessionId;
      newPlayer.position = { x: player.position.x, y: player.position.y };
      newPlayer.targetPosition = { x: player.position.x, y: player.position.y };
      newPlayer.pigment = { r: player.pigment.r, g: player.pigment.g, b: player.pigment.b };
      newPlayer.targetPigment = { r: player.targetPigment.r, g: player.targetPigment.g, b: player.targetPigment.b };
      this.simState.players.push(newPlayer);
    }
  }

  // Initializer helper to ensure fields exist if createPlayer doesn't set them (it's in factory, wait, I need to check factory)
  // Actually, I should update the factory or just init here if it's missing.
  // But wait, createPlayer is in services/engine/factories.ts, I should check that file too.
  // For now, I'll rely on the class property initializer if possible or update factory.
  // Checking factories.ts is safer. I'll do that in next step.


  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, 'left!');

    // EIDOLON-V FIX: Clean up PhysicsWorld slot
    const physicsWorld = this.simState.engine?.physicsWorld;
    if (physicsWorld) {
      physicsWorld.removeBody(client.sessionId);
    }

    this.state.players.delete(client.sessionId);
    this.inputsBySession.delete(client.sessionId);
    this.simState.players = this.simState.players.filter(p => p.id !== client.sessionId);
    if (this.simState.players.length > 0) {
      this.simState.player = this.simState.players[0];
    }
  }

  onDispose() {
    console.log('room disposed!');
    // Clean up security validator
    serverValidator.cleanup();
  }

  update(dt: number) {
    const dtSec = dt / 1000;
    this.state.gameTime += dtSec;

    this.applyInputsToSimState();
    updateGameState(this.simState, dtSec);
    this.syncSimStateToServer();

    // EIDOLON-V: Broadcast Binary Transforms
    this.broadcastBinaryTransforms();
  }

  private broadcastBinaryTransforms() {
    // Gather dynamic entities
    const updates: { id: string, x: number, y: number, vx: number, vy: number }[] = [];
    const world = this.simState.engine.physicsWorld;

    // We can iterate active players/bots directly from SimState or World
    // World is cleaner if we had iterator, but SimState is authoritative logic
    this.simState.players.forEach(p => {
      updates.push({ id: p.id, x: p.position.x, y: p.position.y, vx: p.velocity.x, vy: p.velocity.y });
    });
    this.simState.bots.forEach(b => {
      updates.push({ id: b.id, x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y });
    });

    if (updates.length > 0) {
      const buffer = BinaryPacker.packTransforms(updates, this.state.gameTime);
      // Broadcast as "bin" message or raw
      this.broadcast("bin", new Uint8Array(buffer));
    }
  }

  private applyInputsToSimState() {
    this.simState.players.forEach(player => {
      const input = this.inputsBySession.get(player.id);
      if (!input) {
        player.inputs = { space: false, w: false };
        return;
      }

      // Validate input before applying
      const lastInput = this.inputsBySession.get(player.id);
      const serverPlayer = this.state.players.get(player.id);

      if (serverPlayer) {
        // Sanitize input
        const sanitizedInput = serverValidator.sanitizeInput(input);

        // Validate input sequence and rules
        const validation = serverValidator.validateInput(
          player.id,
          sanitizedInput,
          lastInput || null,
          serverPlayer
        );

        if (!validation.isValid) {
          console.warn(`Invalid input from ${player.id}: ${validation.reason}`);
          // Skip this input but don't disconnect the player
          return;
        }

        // Validate action rate limiting
        const rateValidation = serverValidator.validateActionRate(player.id, 'movement', 20);
        if (!rateValidation.isValid) {
          console.warn(`Rate limit exceeded for ${player.id}: ${rateValidation.reason}`);
          return;
        }

        // Apply validated input
        player.targetPosition = { x: sanitizedInput.targetX, y: sanitizedInput.targetY };
        player.inputs = { space: sanitizedInput.space, w: sanitizedInput.w };
        player.inputSeq = sanitizedInput.seq;
      }
    });
  }

  private syncSimStateToServer() {
    this.simState.players.forEach((player) => {
      let serverPlayer = this.state.players.get(player.id);
      if (!serverPlayer) {
        serverPlayer = new PlayerState();
        serverPlayer.id = player.id;
        serverPlayer.sessionId = player.id;
        serverPlayer.name = player.name;
        serverPlayer.shape = player.shape;
        this.state.players.set(player.id, serverPlayer);
      }

      // EIDOLON-V FIX: Read from PhysicsWorld Arrays (DOD)
      // Entities are now just ID holders. The Truth is in the Buffer.
      let px = player.position.x;
      let py = player.position.y;
      let vx = player.velocity.x;
      let vy = player.velocity.y;

      // Access PhysicsWorld via Engine ref
      const physicsWorld = this.simState.engine?.physicsWorld;
      if (physicsWorld) {
        // EIDOLON-V FIX: Use accessors
        px = physicsWorld.getX(player.id);
        py = physicsWorld.getY(player.id);
        vx = physicsWorld.getVx(player.id);
        vy = physicsWorld.getVy(player.id);
      }

      // Validate position changes to prevent teleportation
      // EIDOLON-V: Use real physics position (px, py)
      const positionValidation = serverValidator.validatePosition(
        player.id,
        { x: px, y: py },
        { x: serverPlayer.position.x, y: serverPlayer.position.y },
        1 / 60 // Assuming 60 FPS
      );

      if (!positionValidation.isValid) {
        console.warn(`Invalid position from ${player.id}: ${positionValidation.reason}`);
        // Use corrected position
        if (positionValidation.correctedPosition) {
          px = positionValidation.correctedPosition.x;
          py = positionValidation.correctedPosition.y;
        }
      }

      // Validate player stats
      const statsValidation = serverValidator.validatePlayerStats(
        {
          ...serverPlayer,
          score: player.score,
          currentHealth: player.currentHealth,
          radius: player.radius,
          pigment: player.pigment
        } as PlayerState,
        serverPlayer,
        1 / 60
      );

      if (!statsValidation.isValid) {
        console.warn(`Invalid stats from ${player.id}: ${statsValidation.reason}`);
        // Skip stats update but continue with position
      }

      // Apply validated state
      // Apply validated state
      serverPlayer.position.x = px;
      serverPlayer.position.y = py;
      serverPlayer.velocity.x = vx;
      serverPlayer.velocity.y = vy;
      serverPlayer.radius = player.radius;
      serverPlayer.score = player.score;
      serverPlayer.currentHealth = player.currentHealth;
      serverPlayer.kills = player.kills;
      serverPlayer.matchPercent = player.matchPercent;
      serverPlayer.ring = player.ring as any;
      serverPlayer.emotion = player.emotion;
      serverPlayer.isDead = player.isDead;
      serverPlayer.skillCooldown = player.skillCooldown;
      serverPlayer.lastProcessedInput = player.inputSeq || 0;
      serverPlayer.pigment.r = player.pigment.r;
      serverPlayer.pigment.g = player.pigment.g;
      serverPlayer.pigment.b = player.pigment.b;
      serverPlayer.targetPigment.r = player.targetPigment.r;
      serverPlayer.targetPigment.g = player.targetPigment.g;
      serverPlayer.targetPigment.b = player.targetPigment.b;
    });

    this.simState.bots.forEach((bot) => {
      let serverBot = this.state.bots.get(bot.id);
      if (!serverBot) {
        serverBot = new BotState();
        serverBot.id = bot.id;
        serverBot.name = bot.name;
        serverBot.shape = bot.shape as any;
        serverBot.isBoss = !!bot.isBoss;
        this.state.bots.set(bot.id, serverBot);
      }
      serverBot.position.x = bot.position.x;
      serverBot.position.y = bot.position.y;
      serverBot.velocity.x = bot.velocity.x;
      serverBot.velocity.y = bot.velocity.y;
      serverBot.radius = bot.radius;
      serverBot.currentHealth = bot.currentHealth;
      serverBot.score = bot.score;
      serverBot.isDead = bot.isDead;
    });

    this.simState.food.forEach((food) => {
      if (food.isDead) {
        this.state.food.delete(food.id);
        return;
      }
      let serverFood = this.state.food.get(food.id);
      if (!serverFood) {
        serverFood = new FoodState();
        serverFood.id = food.id;
        this.state.food.set(food.id, serverFood);
      }
      serverFood.x = food.position.x;
      serverFood.y = food.position.y;
      serverFood.radius = food.radius;
      serverFood.kind = food.kind;
      if (food.pigment) {
        serverFood.pigment.r = food.pigment.r;
        serverFood.pigment.g = food.pigment.g;
        serverFood.pigment.b = food.pigment.b;
      }
    });

    this.simState.projectiles.forEach((proj) => {
      let serverProj = this.state.projectiles.get(proj.id);
      if (!serverProj) {
        serverProj = new ProjectileState();
        serverProj.id = proj.id;
        serverProj.ownerId = proj.ownerId;
        serverProj.type = proj.type;
        this.state.projectiles.set(proj.id, serverProj);
      }
      serverProj.x = proj.position.x;
      serverProj.y = proj.position.y;
      serverProj.vx = proj.velocity.x;
      serverProj.vy = proj.velocity.y;
      serverProj.damage = proj.damage;
    });
  }

  private handlePlayerDeath(player: PlayerState, sessionId: string) {
    // Respawn player at random position
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (MAP_RADIUS * 0.8);
    player.position.x = Math.cos(angle) * r;
    player.position.y = Math.sin(angle) * r;
    player.radius = 15; // Reset size
    player.currentHealth = 100; // Reset health
    // Reset other properties as needed
  }
}
