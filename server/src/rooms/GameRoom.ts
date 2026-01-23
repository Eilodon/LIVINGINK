/**
 * GU-KING MULTIPLAYER GAME ROOM
 *
 * Authoritative server implementation using Colyseus
 * Handles game logic, physics, and state synchronization
 */

import { Room, Client, Delayed } from 'colyseus';
import {
  GameRoomState,
  PlayerState,
  BotState,
  FoodState,
  HazardState,
  ProjectileState,
  PowerUpState,
  LavaZoneState,
  Vector2,
  Faction,
  SizeTier,
  BloodlineId,
} from '../schema/GameState.js';

// ============================================
// CONSTANTS (mirroring client)
// ============================================

const WORLD_WIDTH = 3400;
const WORLD_HEIGHT = 3400;
const MAP_RADIUS = 1600;
const INITIAL_ZONE_RADIUS = 1600;
const GAME_DURATION = 480;
const TICK_RATE = 30; // 30 ticks per second
const PLAYER_START_RADIUS = 28;
const MAX_ENTITY_RADIUS = 155;
const BOT_COUNT = 20; // Reduced for multiplayer (players fill the rest)
const FOOD_COUNT = 260;
const SPAWN_PROTECTION_TIME = 5;

// Elemental advantages
const ELEMENTAL_ADVANTAGE: Record<string, string> = {
  [Faction.Metal]: Faction.Wood,
  [Faction.Wood]: Faction.Earth,
  [Faction.Earth]: Faction.Water,
  [Faction.Water]: Faction.Fire,
  [Faction.Fire]: Faction.Metal,
};

// Bloodline configurations
const BLOODLINE_CONFIG: Record<string, { faction: string; passive: string; stats: Record<string, number> }> = {
  [BloodlineId.HoaDiemVuong]: {
    faction: Faction.Fire,
    passive: 'burn_damage_30',
    stats: { damage: 1.3, health: 0.9 },
  },
  [BloodlineId.ThietGiapThan]: {
    faction: Faction.Metal,
    passive: 'first_hit_crit',
    stats: { damage: 1.4, speed: 1.1 },
  },
  [BloodlineId.BangTamVuong]: {
    faction: Faction.Water,
    passive: 'extra_projectiles',
    stats: { speed: 1.5, health: 0.8 },
  },
  [BloodlineId.CoThuTinh]: {
    faction: Faction.Wood,
    passive: 'low_hp_regen',
    stats: { health: 1.3, regen: 1.5 },
  },
  [BloodlineId.ThoLongHoang]: {
    faction: Faction.Earth,
    passive: 'reflect_melee',
    stats: { defense: 1.5, health: 1.4, speed: 0.7 },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const generateId = () => Math.random().toString(36).substring(2, 10);

const distSq = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const randomInCircle = (centerX: number, centerY: number, radius: number) => {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return {
    x: centerX + Math.cos(angle) * r,
    y: centerY + Math.sin(angle) * r,
  };
};

const getFactionZoneCenter = (faction: string) => {
  const cx = WORLD_WIDTH / 2;
  const cy = WORLD_HEIGHT / 2;
  const offset = MAP_RADIUS * 0.55;

  switch (faction) {
    case Faction.Fire:
      return { x: cx, y: cy - offset };
    case Faction.Water:
      return { x: cx, y: cy + offset };
    case Faction.Metal:
      return { x: cx + offset, y: cy };
    case Faction.Wood:
      return { x: cx - offset, y: cy };
    case Faction.Earth:
      return { x: cx, y: cy };
    default:
      return { x: cx, y: cy };
  }
};

// ============================================
// GAME ROOM CLASS
// ============================================

interface PlayerInputs {
  targetX: number;
  targetY: number;
  skill: boolean;
  eject: boolean;
  seq: number;
}

export class GameRoom extends Room<GameRoomState> {
  private gameLoop!: Delayed;
  private playerInputs = new Map<string, PlayerInputs>();
  private tickCount = 0;

  // -------------------- LIFECYCLE --------------------

  onCreate(options: any) {
    console.log('GameRoom created!', options);

    this.setState(new GameRoomState());
    this.maxClients = 30;

    // Initialize world
    this.initializeWorld();

    // Set up tick rate
    this.setSimulationInterval((dt) => this.update(dt), 1000 / TICK_RATE);

    // Register message handlers
    this.onMessage('input', (client, data: PlayerInputs) => {
      this.playerInputs.set(client.sessionId, data);
    });

    this.onMessage('skill', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.skillCooldown <= 0) {
        this.castSkill(player);
      }
    });

    this.onMessage('eject', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.radius > PLAYER_START_RADIUS + 8) {
        this.ejectMass(player);
      }
    });
  }

  onJoin(client: Client, options: { name?: string; bloodline?: string }) {
    console.log(`Player ${client.sessionId} joined!`);

    const bloodlineId = options.bloodline || BloodlineId.HoaDiemVuong;
    const bloodlineConfig = BLOODLINE_CONFIG[bloodlineId] || BLOODLINE_CONFIG[BloodlineId.HoaDiemVuong];

    const player = new PlayerState();
    player.id = client.sessionId;
    player.sessionId = client.sessionId;
    player.name = options.name || `Player${Math.floor(Math.random() * 1000)}`;
    player.faction = bloodlineConfig.faction;
    player.bloodline = bloodlineId;

    // Spawn position (in faction zone)
    const spawnZone = getFactionZoneCenter(bloodlineConfig.faction);
    const spawnPos = randomInCircle(spawnZone.x, spawnZone.y, 200);
    player.position.x = spawnPos.x;
    player.position.y = spawnPos.y;
    player.targetPosition.x = spawnPos.x;
    player.targetPosition.y = spawnPos.y;

    // Apply bloodline stats
    player.damageMultiplier = bloodlineConfig.stats.damage || 1;
    player.maxHealth = 100 * (bloodlineConfig.stats.health || 1);
    player.currentHealth = player.maxHealth;

    player.spawnTime = this.state.gameTime;
    player.isInvulnerable = true;

    this.state.players.set(client.sessionId, player);
    this.updateLeaderboard();

    // Initialize input state
    this.playerInputs.set(client.sessionId, {
      targetX: player.position.x,
      targetY: player.position.y,
      skill: false,
      eject: false,
      seq: 0,
    });
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left! (consented: ${consented})`);

    this.state.players.delete(client.sessionId);
    this.playerInputs.delete(client.sessionId);
    this.updateLeaderboard();
  }

  onDispose() {
    console.log('GameRoom disposed!');
  }

  // -------------------- INITIALIZATION --------------------

  private initializeWorld() {
    // Spawn food
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.spawnFood();
    }

    // Spawn bots
    for (let i = 0; i < BOT_COUNT; i++) {
      this.spawnBot(i.toString());
    }

    console.log(`World initialized: ${FOOD_COUNT} food, ${BOT_COUNT} bots`);
  }

  private spawnFood(isEjected = false, pos?: { x: number; y: number }) {
    const food = new FoodState();
    food.id = generateId();

    if (pos) {
      food.x = pos.x;
      food.y = pos.y;
    } else {
      const spawnPos = randomInCircle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, MAP_RADIUS * 0.9);
      food.x = spawnPos.x;
      food.y = spawnPos.y;
    }

    food.value = isEjected ? 5 : Math.random() < 0.1 ? 3 : 1;
    food.kind = isEjected ? 'ejected' : 'normal';
    food.radius = isEjected ? 10 : 7;

    this.state.food.set(food.id, food);
    return food;
  }

  private spawnBot(index: string) {
    const bot = new BotState();
    bot.id = `bot-${index}`;

    const factions = Object.values(Faction);
    bot.faction = factions[Math.floor(Math.random() * factions.length)];

    const spawnZone = getFactionZoneCenter(bot.faction);
    const spawnPos = randomInCircle(spawnZone.x, spawnZone.y, 300);
    bot.position.x = spawnPos.x;
    bot.position.y = spawnPos.y;

    bot.radius = PLAYER_START_RADIUS + Math.random() * 30;
    bot.maxHealth = 100;
    bot.currentHealth = bot.maxHealth;
    bot.isInvulnerable = true;

    this.state.bots.set(bot.id, bot);
    return bot;
  }

  // -------------------- MAIN UPDATE LOOP --------------------

  private update(dt: number) {
    const dtSec = dt / 1000;
    this.tickCount++;

    this.state.serverTick = this.tickCount;
    this.state.serverTime = Date.now();
    this.state.gameTime += dtSec;

    // Clear VFX events from last tick
    this.state.vfxEvents.clear();

    // Update zone radius (shrinking)
    this.updateZoneRadius();

    // Update round
    this.updateRound();

    // Process player inputs
    this.processPlayerInputs(dtSec);

    // Update all players
    this.state.players.forEach((player) => {
      if (!player.isDead) {
        this.updatePlayer(player, dtSec);
      }
    });

    // Update bots
    this.state.bots.forEach((bot) => {
      if (!bot.isDead) {
        this.updateBot(bot, dtSec);
      }
    });

    // Update projectiles
    this.updateProjectiles(dtSec);

    // Update hazards
    this.updateHazards(dtSec);

    // Check collisions
    this.checkCollisions();

    // Respawn food
    this.maintainFoodCount();

    // Update king
    this.updateKing();

    // Update leaderboard (every 10 ticks)
    if (this.tickCount % 10 === 0) {
      this.updateLeaderboard();
    }
  }

  private updateZoneRadius() {
    const time = this.state.gameTime;

    if (time < 150) {
      this.state.zoneRadius = INITIAL_ZONE_RADIUS;
    } else if (time < 300) {
      const progress = (time - 150) / 150;
      this.state.zoneRadius = INITIAL_ZONE_RADIUS * (1 - progress * 0.4);
    } else if (time < 450) {
      const progress = (time - 300) / 150;
      this.state.zoneRadius = INITIAL_ZONE_RADIUS * 0.6 * (1 - progress * 0.5);
    } else {
      const progress = Math.min(1, (time - 450) / 30);
      this.state.zoneRadius = Math.max(320, INITIAL_ZONE_RADIUS * 0.3 * (1 - progress));
    }
  }

  private updateRound() {
    const time = this.state.gameTime;
    const prevRound = this.state.currentRound;

    if (time >= 450) this.state.currentRound = 4;
    else if (time >= 300) this.state.currentRound = 3;
    else if (time >= 150) this.state.currentRound = 2;
    else this.state.currentRound = 1;

    if (this.state.currentRound > prevRound) {
      // Broadcast round change VFX
      this.state.vfxEvents.push(`round_change:${this.state.currentRound}`);
    }
  }

  private processPlayerInputs(dt: number) {
    this.playerInputs.forEach((input, sessionId) => {
      const player = this.state.players.get(sessionId);
      if (player && !player.isDead) {
        // Smooth target position update
        const smoothing = 0.3;
        player.targetPosition.x += (input.targetX - player.targetPosition.x) * smoothing;
        player.targetPosition.y += (input.targetY - player.targetPosition.y) * smoothing;
      }
    });
  }

  private updatePlayer(player: PlayerState, dt: number) {
    // Clear spawn invulnerability
    if (player.isInvulnerable && this.state.gameTime - player.spawnTime > SPAWN_PROTECTION_TIME) {
      player.isInvulnerable = false;
    }

    // Update skill cooldown
    if (player.skillCooldown > 0) {
      player.skillCooldown = Math.max(0, player.skillCooldown - dt);
    }

    // Update status effects
    this.updateStatusEffects(player.statusEffects, dt);

    // Physics
    this.applyPhysics(player, dt);

    // Zone damage
    this.applyZoneDamage(player, dt);

    // Update tier
    this.updatePlayerTier(player);

    // Update trail
    this.updateTrail(player);
  }

  private updateBot(bot: BotState, dt: number) {
    // Clear spawn invulnerability
    if (bot.isInvulnerable && Math.random() < 0.01) {
      bot.isInvulnerable = false;
    }

    // Simple AI: wander toward faction zone or chase nearby food
    const zoneCenter = getFactionZoneCenter(bot.faction);
    const wanderTarget = randomInCircle(zoneCenter.x, zoneCenter.y, 400);

    // Move toward target
    const dx = wanderTarget.x - bot.position.x;
    const dy = wanderTarget.y - bot.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) {
      const speed = 3 * (1 - bot.radius / MAX_ENTITY_RADIUS * 0.3);
      bot.velocity.x += (dx / dist) * speed * dt;
      bot.velocity.y += (dy / dist) * speed * dt;
    }

    // Apply friction
    bot.velocity.x *= 0.93;
    bot.velocity.y *= 0.93;

    // Update position
    bot.position.x += bot.velocity.x;
    bot.position.y += bot.velocity.y;

    // Constrain to map
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    const distFromCenter = Math.sqrt((bot.position.x - cx) ** 2 + (bot.position.y - cy) ** 2);
    if (distFromCenter > MAP_RADIUS - bot.radius) {
      const angle = Math.atan2(bot.position.y - cy, bot.position.x - cx);
      bot.position.x = cx + Math.cos(angle) * (MAP_RADIUS - bot.radius);
      bot.position.y = cy + Math.sin(angle) * (MAP_RADIUS - bot.radius);
    }

    // Zone damage
    if (distFromCenter > this.state.zoneRadius) {
      bot.currentHealth -= 10 * dt;
      if (bot.currentHealth <= 0) {
        bot.isDead = true;
      }
    }

    // Update trail
    this.updateBotTrail(bot);
  }

  private applyPhysics(player: PlayerState, dt: number) {
    const target = player.targetPosition;
    const pos = player.position;

    // Direction to target
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Size penalty
    const sizePenalty = 1 - (player.radius / MAX_ENTITY_RADIUS) * 0.4;
    const baseSpeed = 6.8 * sizePenalty;

    // Status effect modifiers
    let speedMod = player.statusEffects.speedBoost;
    if (player.statusEffects.slowed) {
      speedMod *= player.statusEffects.slowMultiplier;
    }
    if (player.statusEffects.rooted > 0) {
      speedMod = 0;
    }

    const maxSpeed = baseSpeed * speedMod;

    if (dist > 5) {
      const accel = 1.0;
      player.velocity.x += (dx / dist) * accel;
      player.velocity.y += (dy / dist) * accel;
    }

    // Apply friction
    player.velocity.x *= 0.93;
    player.velocity.y *= 0.93;

    // Clamp speed
    const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
    if (speed > maxSpeed) {
      player.velocity.x = (player.velocity.x / speed) * maxSpeed;
      player.velocity.y = (player.velocity.y / speed) * maxSpeed;
    }

    // Update position
    pos.x += player.velocity.x;
    pos.y += player.velocity.y;

    // Constrain to map
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    const distFromCenter = Math.sqrt((pos.x - cx) ** 2 + (pos.y - cy) ** 2);
    if (distFromCenter > MAP_RADIUS - player.radius) {
      const angle = Math.atan2(pos.y - cy, pos.x - cx);
      pos.x = cx + Math.cos(angle) * (MAP_RADIUS - player.radius);
      pos.y = cy + Math.sin(angle) * (MAP_RADIUS - player.radius);
    }
  }

  private applyZoneDamage(player: PlayerState, dt: number) {
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    const distFromCenter = Math.sqrt((player.position.x - cx) ** 2 + (player.position.y - cy) ** 2);

    if (distFromCenter > this.state.zoneRadius) {
      const damage = this.state.currentRound >= 4 ? 20 : this.state.currentRound >= 3 ? 12 : 8;
      player.currentHealth -= damage * dt;

      if (player.currentHealth <= 0) {
        this.killPlayer(player, null);
      }
    } else {
      // Regen inside zone
      if (player.currentHealth < player.maxHealth) {
        player.currentHealth = Math.min(player.maxHealth, player.currentHealth + 1 * dt);
      }
    }
  }

  private updateStatusEffects(effects: any, dt: number) {
    if (effects.invulnerable > 0) effects.invulnerable -= dt;
    if (effects.burnTimer > 0) effects.burnTimer -= dt;
    if (effects.slowTimer > 0) {
      effects.slowTimer -= dt;
      if (effects.slowTimer <= 0) {
        effects.slowed = false;
        effects.slowMultiplier = 1;
      }
    }
    if (effects.poisonTimer > 0) effects.poisonTimer -= dt;
    if (effects.rooted > 0) effects.rooted -= dt;
    if (effects.damageFlash > 0) effects.damageFlash -= dt * 5;
    if (effects.speedBoostTimer > 0) {
      effects.speedBoostTimer -= dt;
      if (effects.speedBoostTimer <= 0) {
        effects.speedBoost = 1;
      }
    }
  }

  private updatePlayerTier(player: PlayerState) {
    const radiusProgress = (player.radius - PLAYER_START_RADIUS) / (MAX_ENTITY_RADIUS - PLAYER_START_RADIUS);

    if (radiusProgress >= 0.8) player.tier = SizeTier.AncientKing;
    else if (radiusProgress >= 0.6) player.tier = SizeTier.Elder;
    else if (radiusProgress >= 0.4) player.tier = SizeTier.Adult;
    else if (radiusProgress >= 0.2) player.tier = SizeTier.Juvenile;
    else player.tier = SizeTier.Larva;
  }

  private updateTrail(player: PlayerState) {
    // Add current position to trail
    const newPoint = new Vector2();
    newPoint.x = player.position.x;
    newPoint.y = player.position.y;

    player.trail.push(newPoint);

    // Keep only last 12 positions
    while (player.trail.length > 12) {
      player.trail.shift();
    }
  }

  private updateBotTrail(bot: BotState) {
    const newPoint = new Vector2();
    newPoint.x = bot.position.x;
    newPoint.y = bot.position.y;

    bot.trail.push(newPoint);

    while (bot.trail.length > 12) {
      bot.trail.shift();
    }
  }

  private updateProjectiles(dt: number) {
    const toRemove: string[] = [];

    this.state.projectiles.forEach((proj, id) => {
      proj.x += proj.vx * dt * 10;
      proj.y += proj.vy * dt * 10;
      proj.duration -= dt;

      if (proj.duration <= 0) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => this.state.projectiles.delete(id));
  }

  private updateHazards(dt: number) {
    const toRemove: string[] = [];

    this.state.hazards.forEach((hazard, id) => {
      hazard.timer -= dt;

      if (hazard.timer <= 0 && !hazard.active) {
        hazard.active = true;
        this.triggerHazard(hazard);
      }

      if (hazard.active && hazard.timer <= -0.5) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => this.state.hazards.delete(id));
  }

  private triggerHazard(hazard: HazardState) {
    this.state.vfxEvents.push(`hazard:${hazard.type}:${hazard.x}:${hazard.y}`);

    // Apply damage to entities in range
    this.state.players.forEach((player) => {
      if (player.isDead || player.isInvulnerable) return;
      const d = Math.sqrt((player.position.x - hazard.x) ** 2 + (player.position.y - hazard.y) ** 2);
      if (d < hazard.radius) {
        player.currentHealth -= 20;
        player.statusEffects.damageFlash = 1;
        if (player.currentHealth <= 0) {
          this.killPlayer(player, null);
        }
      }
    });
  }

  private checkCollisions() {
    // Player vs Food
    this.state.players.forEach((player) => {
      if (player.isDead) return;

      this.state.food.forEach((food, foodId) => {
        if (food.isDead) return;

        const d = Math.sqrt((player.position.x - food.x) ** 2 + (player.position.y - food.y) ** 2);
        if (d < player.radius) {
          food.isDead = true;
          this.state.food.delete(foodId);

          // Apply growth
          const growth = food.value * 0.08;
          player.radius = Math.min(MAX_ENTITY_RADIUS, player.radius + growth);
          player.score += food.value;

          // Soul Essence (new mechanic)
          if (food.kind === 'relic') {
            player.soulEssence += 10;
            player.score += 25;
            this.state.vfxEvents.push(`relic_pickup:${player.id}`);
          }
        }
      });

      // Player vs Bot
      this.state.bots.forEach((bot) => {
        if (bot.isDead) return;

        const d = Math.sqrt((player.position.x - bot.position.x) ** 2 + (player.position.y - bot.position.y) ** 2);
        const minDist = player.radius + bot.radius;

        if (d < minDist * 0.9) {
          const ratio = player.radius / bot.radius;

          if (ratio >= 1.1) {
            // Player consumes bot
            this.consumeEntity(player, bot);
          } else if (ratio <= 0.9) {
            // Bot consumes player
            this.killPlayer(player, bot.id);
          } else {
            // Combat
            this.resolveCombat(player, bot);
          }
        }
      });
    });

    // Player vs Player
    const playerList = Array.from(this.state.players.values());
    for (let i = 0; i < playerList.length; i++) {
      for (let j = i + 1; j < playerList.length; j++) {
        const p1 = playerList[i];
        const p2 = playerList[j];

        if (p1.isDead || p2.isDead) continue;
        if (p1.isInvulnerable || p2.isInvulnerable) continue;

        const d = Math.sqrt((p1.position.x - p2.position.x) ** 2 + (p1.position.y - p2.position.y) ** 2);
        const minDist = p1.radius + p2.radius;

        if (d < minDist * 0.9) {
          const ratio = p1.radius / p2.radius;

          if (ratio >= 1.1) {
            this.consumePlayer(p1, p2);
          } else if (ratio <= 0.9) {
            this.consumePlayer(p2, p1);
          } else {
            this.resolvePlayerCombat(p1, p2);
          }
        }
      }
    }
  }

  private consumeEntity(predator: PlayerState, prey: BotState) {
    prey.isDead = true;

    // Growth
    const growth = prey.radius * 0.16;
    predator.radius = Math.min(MAX_ENTITY_RADIUS, predator.radius + growth);
    predator.score += Math.floor(prey.radius * 2);
    predator.kills++;
    predator.soulEssence += 5;

    // VFX
    this.state.vfxEvents.push(`kill:${predator.id}:${prey.position.x}:${prey.position.y}`);

    // Respawn bot after delay
    this.clock.setTimeout(() => {
      if (this.state.bots.has(prey.id)) {
        const bot = this.state.bots.get(prey.id)!;
        const spawnPos = randomInCircle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, MAP_RADIUS * 0.7);
        bot.position.x = spawnPos.x;
        bot.position.y = spawnPos.y;
        bot.radius = PLAYER_START_RADIUS;
        bot.currentHealth = bot.maxHealth;
        bot.isDead = false;
        bot.isInvulnerable = true;
      }
    }, 20000);
  }

  private consumePlayer(predator: PlayerState, prey: PlayerState) {
    // VFX
    this.state.vfxEvents.push(`player_kill:${predator.id}:${prey.id}:${prey.position.x}:${prey.position.y}`);

    // Growth
    const growth = prey.radius * 0.2;
    predator.radius = Math.min(MAX_ENTITY_RADIUS, predator.radius + growth);
    predator.score += Math.floor(prey.score * 0.5);
    predator.kills++;
    predator.soulEssence += 15;

    // Lifesteal
    if (predator.lifesteal > 0) {
      predator.currentHealth = Math.min(predator.maxHealth, predator.currentHealth + prey.maxHealth * predator.lifesteal);
    }

    this.killPlayer(prey, predator.id);
  }

  private resolveCombat(player: PlayerState, bot: BotState) {
    // Elemental advantage check
    const advantage = ELEMENTAL_ADVANTAGE[player.faction];
    const dmgMod = advantage === bot.faction ? 3 : 1;

    const damage = 5 * player.damageMultiplier * dmgMod;
    bot.currentHealth -= damage;
    bot.statusEffects.damageFlash = 1;

    // Counter damage
    const counterDamage = 3 / player.defense;
    player.currentHealth -= counterDamage;
    player.statusEffects.damageFlash = 0.5;

    if (bot.currentHealth <= 0) {
      this.consumeEntity(player, bot);
    }

    if (player.currentHealth <= 0) {
      this.killPlayer(player, bot.id);
    }
  }

  private resolvePlayerCombat(p1: PlayerState, p2: PlayerState) {
    // Elemental advantages
    const p1Advantage = ELEMENTAL_ADVANTAGE[p1.faction] === p2.faction;
    const p2Advantage = ELEMENTAL_ADVANTAGE[p2.faction] === p1.faction;

    const p1Mod = p1Advantage ? 3 : p2Advantage ? 0.33 : 1;
    const p2Mod = p2Advantage ? 3 : p1Advantage ? 0.33 : 1;

    const p1Damage = 5 * p1.damageMultiplier * p1Mod;
    const p2Damage = 5 * p2.damageMultiplier * p2Mod;

    p1.currentHealth -= p2Damage / p1.defense;
    p2.currentHealth -= p1Damage / p2.defense;

    p1.statusEffects.damageFlash = 0.5;
    p2.statusEffects.damageFlash = 0.5;

    if (p1.currentHealth <= 0 && p2.currentHealth <= 0) {
      // Both die
      this.killPlayer(p1, p2.id);
      this.killPlayer(p2, p1.id);
    } else if (p1.currentHealth <= 0) {
      this.consumePlayer(p2, p1);
    } else if (p2.currentHealth <= 0) {
      this.consumePlayer(p1, p2);
    }
  }

  private killPlayer(player: PlayerState, killerId: string | null) {
    player.isDead = true;
    this.state.vfxEvents.push(`death:${player.id}:${player.position.x}:${player.position.y}`);

    // Notify client
    const client = this.clients.find((c) => c.sessionId === player.sessionId);
    if (client) {
      client.send('death', {
        killerId,
        score: player.score,
        kills: player.kills,
      });
    }
  }

  private castSkill(player: PlayerState) {
    player.skillCooldown = player.maxSkillCooldown;

    // Create projectile based on faction
    const proj = new ProjectileState();
    proj.id = generateId();
    proj.ownerId = player.id;

    // Direction toward target
    const dx = player.targetPosition.x - player.position.x;
    const dy = player.targetPosition.y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : 1;
    const dirY = dist > 0 ? dy / dist : 0;

    proj.x = player.position.x + dirX * player.radius;
    proj.y = player.position.y + dirY * player.radius;
    proj.vx = dirX * 15;
    proj.vy = dirY * 15;
    proj.damage = 15 * player.damageMultiplier;
    proj.duration = 2;

    switch (player.faction) {
      case Faction.Water:
        proj.type = 'ice';
        break;
      case Faction.Metal:
        proj.type = 'sting';
        // Metal gets dash
        player.statusEffects.speedBoost = 30;
        player.statusEffects.speedBoostTimer = 0.15;
        break;
      case Faction.Wood:
        proj.type = 'web';
        proj.damage = 5; // Lower damage but has pull effect
        break;
      default:
        proj.type = 'ice';
    }

    this.state.projectiles.set(proj.id, proj);
    this.state.vfxEvents.push(`skill:${player.faction}:${player.id}`);
  }

  private ejectMass(player: PlayerState) {
    player.radius -= 4;

    const dx = player.targetPosition.x - player.position.x;
    const dy = player.targetPosition.y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : 1;
    const dirY = dist > 0 ? dy / dist : 0;

    const ejectPos = {
      x: player.position.x + dirX * (player.radius + 20),
      y: player.position.y + dirY * (player.radius + 20),
    };

    this.spawnFood(true, ejectPos);

    // Recoil
    player.velocity.x -= dirX * 2;
    player.velocity.y -= dirY * 2;
  }

  private maintainFoodCount() {
    const currentCount = this.state.food.size;
    const deficit = FOOD_COUNT - currentCount;

    for (let i = 0; i < Math.min(deficit, 5); i++) {
      this.spawnFood();
    }
  }

  private updateKing() {
    let maxRadius = 0;
    let kingId = '';

    this.state.players.forEach((player) => {
      if (!player.isDead && player.radius > maxRadius) {
        maxRadius = player.radius;
        kingId = player.id;
      }
    });

    this.state.bots.forEach((bot) => {
      if (!bot.isDead && bot.radius > maxRadius) {
        maxRadius = bot.radius;
        kingId = bot.id;
      }
    });

    if (this.state.kingId !== kingId) {
      this.state.kingId = kingId;
      if (kingId) {
        this.state.vfxEvents.push(`new_king:${kingId}`);
      }
    }
  }

  private updateLeaderboard() {
    const entries: { id: string; score: number }[] = [];

    this.state.players.forEach((player) => {
      entries.push({ id: player.id, score: player.score });
    });

    entries.sort((a, b) => b.score - a.score);

    this.state.leaderboard.clear();
    entries.slice(0, 10).forEach((e) => {
      this.state.leaderboard.push(e.id);
    });
  }
}
