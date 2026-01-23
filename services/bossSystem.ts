/**
 * GU-KING BOSS SYSTEM
 *
 * Multi-phase boss encounters with:
 * - Phase transitions with visual/mechanical changes
 * - Unique attack patterns per phase
 * - Enrage mechanic
 * - Legendary loot drops
 *
 * Inspired by: Dark Souls, Monster Hunter, Hades
 */

import type { Bot, GameState, Vector2, Faction } from '../types';
import { WORLD_WIDTH, WORLD_HEIGHT, BOSS_MAX_HEALTH, BOSS_DAMAGE, BOSS_RADIUS } from '../constants';
import { vfxManager } from './vfx/VFXManager';
import { audioEngine } from './audio/AudioEngine';

// ============================================
// TYPES
// ============================================

export enum BossPhase {
  Phase1 = 1,
  Phase2 = 2,
  Phase3 = 3,
  Enraged = 4,
}

export enum BossAttackType {
  BasicAttack = 'basic_attack',
  AOESlam = 'aoe_slam',
  SummonMinions = 'summon_minions',
  ElementalBarrage = 'elemental_barrage',
  LaserSweep = 'laser_sweep',
  MeteorShower = 'meteor_shower',
  VoidZone = 'void_zone',
  ChargeAttack = 'charge_attack',
}

export interface BossAttackPattern {
  type: BossAttackType;
  damage: number;
  radius: number;
  cooldown: number;
  chargeTime: number;
  duration: number;
  description: string;
}

export interface BossPhaseConfig {
  phase: BossPhase;
  healthThreshold: number; // Percentage of max health to trigger
  attackPatterns: BossAttackPattern[];
  speedMultiplier: number;
  damageMultiplier: number;
  defenseMultiplier: number;
  specialAbility?: string;
  visualChanges: {
    colorTint: string;
    sizeMultiplier: number;
    particleEffect: string;
  };
}

export interface BossState {
  currentPhase: BossPhase;
  attackCooldown: number;
  currentAttack: BossAttackType | null;
  attackChargeTime: number;
  attackDuration: number;
  targetPosition: Vector2 | null;
  summonedMinions: string[];
  enrageTimer: number;
  isEnraged: boolean;
  phaseTransitionTimer: number;
  isInPhaseTransition: boolean;
}

// ============================================
// BOSS CONFIGURATION
// ============================================

const BOSS_ATTACK_PATTERNS: Record<BossAttackType, BossAttackPattern> = {
  [BossAttackType.BasicAttack]: {
    type: BossAttackType.BasicAttack,
    damage: 15,
    radius: 100,
    cooldown: 2,
    chargeTime: 0.5,
    duration: 0.3,
    description: 'Basic melee attack',
  },
  [BossAttackType.AOESlam]: {
    type: BossAttackType.AOESlam,
    damage: 30,
    radius: 200,
    cooldown: 8,
    chargeTime: 1.5,
    duration: 0.5,
    description: 'Ground slam with shockwave',
  },
  [BossAttackType.SummonMinions]: {
    type: BossAttackType.SummonMinions,
    damage: 0,
    radius: 0,
    cooldown: 20,
    chargeTime: 2,
    duration: 1,
    description: 'Summons 4 elemental minions',
  },
  [BossAttackType.ElementalBarrage]: {
    type: BossAttackType.ElementalBarrage,
    damage: 10,
    radius: 60,
    cooldown: 6,
    chargeTime: 1,
    duration: 2,
    description: 'Fires elemental projectiles in all directions',
  },
  [BossAttackType.LaserSweep]: {
    type: BossAttackType.LaserSweep,
    damage: 25,
    radius: 50,
    cooldown: 12,
    chargeTime: 2,
    duration: 3,
    description: 'Sweeping laser beam',
  },
  [BossAttackType.MeteorShower]: {
    type: BossAttackType.MeteorShower,
    damage: 40,
    radius: 80,
    cooldown: 15,
    chargeTime: 2.5,
    duration: 4,
    description: 'Rains meteors across the arena',
  },
  [BossAttackType.VoidZone]: {
    type: BossAttackType.VoidZone,
    damage: 5, // DPS
    radius: 150,
    cooldown: 10,
    chargeTime: 1,
    duration: 8,
    description: 'Creates damaging void zones',
  },
  [BossAttackType.ChargeAttack]: {
    type: BossAttackType.ChargeAttack,
    damage: 35,
    radius: 80,
    cooldown: 8,
    chargeTime: 1.5,
    duration: 0.5,
    description: 'Charges at target with devastating force',
  },
};

const BOSS_PHASES: BossPhaseConfig[] = [
  {
    phase: BossPhase.Phase1,
    healthThreshold: 1, // 100%
    attackPatterns: [
      BOSS_ATTACK_PATTERNS[BossAttackType.BasicAttack],
      BOSS_ATTACK_PATTERNS[BossAttackType.AOESlam],
    ],
    speedMultiplier: 1,
    damageMultiplier: 1,
    defenseMultiplier: 1,
    visualChanges: {
      colorTint: '#a855f7',
      sizeMultiplier: 1,
      particleEffect: 'boss_aura',
    },
  },
  {
    phase: BossPhase.Phase2,
    healthThreshold: 0.7, // 70%
    attackPatterns: [
      BOSS_ATTACK_PATTERNS[BossAttackType.BasicAttack],
      BOSS_ATTACK_PATTERNS[BossAttackType.AOESlam],
      BOSS_ATTACK_PATTERNS[BossAttackType.SummonMinions],
      BOSS_ATTACK_PATTERNS[BossAttackType.ElementalBarrage],
    ],
    speedMultiplier: 1.2,
    damageMultiplier: 1.2,
    defenseMultiplier: 0.9,
    specialAbility: 'summon_minions',
    visualChanges: {
      colorTint: '#dc2626',
      sizeMultiplier: 1.1,
      particleEffect: 'boss_rage',
    },
  },
  {
    phase: BossPhase.Phase3,
    healthThreshold: 0.4, // 40%
    attackPatterns: [
      BOSS_ATTACK_PATTERNS[BossAttackType.BasicAttack],
      BOSS_ATTACK_PATTERNS[BossAttackType.AOESlam],
      BOSS_ATTACK_PATTERNS[BossAttackType.ElementalBarrage],
      BOSS_ATTACK_PATTERNS[BossAttackType.LaserSweep],
      BOSS_ATTACK_PATTERNS[BossAttackType.ChargeAttack],
    ],
    speedMultiplier: 1.4,
    damageMultiplier: 1.4,
    defenseMultiplier: 0.8,
    specialAbility: 'elemental_shift',
    visualChanges: {
      colorTint: '#f59e0b',
      sizeMultiplier: 1.15,
      particleEffect: 'boss_fury',
    },
  },
  {
    phase: BossPhase.Enraged,
    healthThreshold: 0.15, // 15%
    attackPatterns: [
      BOSS_ATTACK_PATTERNS[BossAttackType.BasicAttack],
      BOSS_ATTACK_PATTERNS[BossAttackType.MeteorShower],
      BOSS_ATTACK_PATTERNS[BossAttackType.VoidZone],
      BOSS_ATTACK_PATTERNS[BossAttackType.ChargeAttack],
    ],
    speedMultiplier: 2,
    damageMultiplier: 2,
    defenseMultiplier: 0.5,
    specialAbility: 'enrage',
    visualChanges: {
      colorTint: '#ef4444',
      sizeMultiplier: 1.25,
      particleEffect: 'boss_enrage',
    },
  },
];

// ============================================
// BOSS STATE MANAGEMENT
// ============================================

const bossStates = new Map<string, BossState>();

export function initializeBossState(bossId: string): BossState {
  const state: BossState = {
    currentPhase: BossPhase.Phase1,
    attackCooldown: 3,
    currentAttack: null,
    attackChargeTime: 0,
    attackDuration: 0,
    targetPosition: null,
    summonedMinions: [],
    enrageTimer: 180, // 3 minutes until forced enrage
    isEnraged: false,
    phaseTransitionTimer: 0,
    isInPhaseTransition: false,
  };

  bossStates.set(bossId, state);
  return state;
}

export function getBossState(bossId: string): BossState | null {
  return bossStates.get(bossId) || null;
}

// ============================================
// BOSS UPDATE LOGIC
// ============================================

export function updateBoss(boss: Bot, gameState: GameState, dt: number): void {
  if (boss.isDead) return;

  let state = bossStates.get(boss.id);
  if (!state) {
    state = initializeBossState(boss.id);
  }

  // Update enrage timer
  state.enrageTimer -= dt;
  if (state.enrageTimer <= 0 && !state.isEnraged) {
    triggerEnrage(boss, state, gameState);
  }

  // Check for phase transition
  const healthPercent = boss.currentHealth / boss.maxHealth;
  const newPhase = determinePhase(healthPercent, state.isEnraged);

  if (newPhase !== state.currentPhase && !state.isInPhaseTransition) {
    triggerPhaseTransition(boss, state, newPhase, gameState);
  }

  // Handle phase transition
  if (state.isInPhaseTransition) {
    state.phaseTransitionTimer -= dt;
    if (state.phaseTransitionTimer <= 0) {
      state.isInPhaseTransition = false;
      applyPhaseChanges(boss, state);
    }
    return; // Boss is invulnerable during transition
  }

  // Update current attack
  if (state.currentAttack) {
    updateCurrentAttack(boss, state, gameState, dt);
  } else {
    // Choose and start new attack
    state.attackCooldown -= dt;
    if (state.attackCooldown <= 0) {
      startNewAttack(boss, state, gameState);
    }
  }

  // Update AI movement
  updateBossMovement(boss, state, gameState, dt);
}

function determinePhase(healthPercent: number, isEnraged: boolean): BossPhase {
  if (isEnraged || healthPercent <= 0.15) return BossPhase.Enraged;
  if (healthPercent <= 0.4) return BossPhase.Phase3;
  if (healthPercent <= 0.7) return BossPhase.Phase2;
  return BossPhase.Phase1;
}

function triggerPhaseTransition(
  boss: Bot,
  state: BossState,
  newPhase: BossPhase,
  gameState: GameState
): void {
  state.isInPhaseTransition = true;
  state.phaseTransitionTimer = 2; // 2 second transition
  state.currentPhase = newPhase;
  state.currentAttack = null;

  // Boss is invulnerable during transition
  boss.isInvulnerable = true;

  // VFX
  vfxManager.triggerBossSpawn(boss.position);

  // Floating text
  const phaseText = newPhase === BossPhase.Enraged
    ? 'CỔ TRÙNG MẪU ENRAGED!'
    : `PHASE ${newPhase}`;

  gameState.floatingTexts.push({
    id: Math.random().toString(),
    position: { ...boss.position, y: boss.position.y - 100 },
    text: phaseText,
    color: newPhase === BossPhase.Enraged ? '#ef4444' : '#f59e0b',
    size: 36,
    life: 3,
    velocity: { x: 0, y: -1 },
  });

  // Audio
  audioEngine.playRoundChange();

  console.log(`[Boss] Phase transition to ${BossPhase[newPhase]}`);
}

function applyPhaseChanges(boss: Bot, state: BossState): void {
  const phaseConfig = BOSS_PHASES.find((p) => p.phase === state.currentPhase);
  if (!phaseConfig) return;

  // Apply stat multipliers
  // Note: In a real implementation, you'd track base stats separately
  boss.maxHealth = BOSS_MAX_HEALTH * (state.isEnraged ? 0.15 : 1);

  // Remove invulnerability
  boss.isInvulnerable = false;

  // Update visual
  boss.color = phaseConfig.visualChanges.colorTint;
}

function triggerEnrage(boss: Bot, state: BossState, gameState: GameState): void {
  state.isEnraged = true;

  // Screen shake
  gameState.shakeIntensity = 2;

  // VFX
  vfxManager.triggerBossSpawn(boss.position);

  // Message
  gameState.floatingTexts.push({
    id: Math.random().toString(),
    position: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 - 200 },
    text: 'CỔ TRÙNG MẪU IS ENRAGED!',
    color: '#ef4444',
    size: 48,
    life: 4,
    velocity: { x: 0, y: 0 },
  });

  audioEngine.playWarning();

  console.log('[Boss] ENRAGED!');
}

// ============================================
// ATTACK LOGIC
// ============================================

function startNewAttack(boss: Bot, state: BossState, gameState: GameState): void {
  const phaseConfig = BOSS_PHASES.find((p) => p.phase === state.currentPhase);
  if (!phaseConfig) return;

  // Choose random attack from available patterns
  const patterns = phaseConfig.attackPatterns;
  const attack = patterns[Math.floor(Math.random() * patterns.length)];

  state.currentAttack = attack.type;
  state.attackChargeTime = attack.chargeTime;
  state.attackDuration = attack.duration;
  state.attackCooldown = attack.cooldown;

  // Find target (usually the player)
  const player = gameState.player;
  if (player && !player.isDead) {
    state.targetPosition = { ...player.position };
  }

  // Telegraph the attack
  telegraphAttack(boss, attack, state.targetPosition, gameState);

  console.log(`[Boss] Starting attack: ${attack.type}`);
}

function telegraphAttack(
  boss: Bot,
  attack: BossAttackPattern,
  targetPosition: Vector2 | null,
  gameState: GameState
): void {
  // Create warning indicator
  if (targetPosition && attack.radius > 0) {
    const hazard = {
      id: `boss-telegraph-${Date.now()}`,
      type: 'lightning' as const,
      position: { ...targetPosition },
      radius: attack.radius,
      timer: attack.chargeTime,
      duration: 0.5,
      active: false,
    };
    gameState.hazards.push(hazard);
  }

  // Warning sound
  audioEngine.playWarning();
}

function updateCurrentAttack(
  boss: Bot,
  state: BossState,
  gameState: GameState,
  dt: number
): void {
  if (!state.currentAttack) return;

  // Charge phase
  if (state.attackChargeTime > 0) {
    state.attackChargeTime -= dt;

    // Boss glows/charges during this time
    if (state.attackChargeTime <= 0) {
      executeAttack(boss, state, gameState);
    }
    return;
  }

  // Execution phase
  if (state.attackDuration > 0) {
    state.attackDuration -= dt;

    // Handle ongoing attack effects (like laser sweep)
    updateOngoingAttack(boss, state, gameState, dt);

    if (state.attackDuration <= 0) {
      state.currentAttack = null;
    }
  }
}

function executeAttack(boss: Bot, state: BossState, gameState: GameState): void {
  const attack = BOSS_ATTACK_PATTERNS[state.currentAttack!];
  if (!attack) return;

  const phaseConfig = BOSS_PHASES.find((p) => p.phase === state.currentPhase);
  const damageMult = phaseConfig?.damageMultiplier || 1;

  switch (state.currentAttack) {
    case BossAttackType.BasicAttack:
      executeBasicAttack(boss, attack, damageMult, gameState);
      break;

    case BossAttackType.AOESlam:
      executeAOESlam(boss, attack, damageMult, gameState);
      break;

    case BossAttackType.SummonMinions:
      executeSummonMinions(boss, state, gameState);
      break;

    case BossAttackType.ElementalBarrage:
      executeElementalBarrage(boss, attack, damageMult, gameState);
      break;

    case BossAttackType.ChargeAttack:
      executeChargeAttack(boss, state, attack, damageMult, gameState);
      break;

    case BossAttackType.MeteorShower:
      executeMeteorShower(boss, attack, damageMult, gameState);
      break;

    case BossAttackType.VoidZone:
      executeVoidZone(boss, state, attack, damageMult, gameState);
      break;

    default:
      break;
  }

  // VFX for attack execution
  vfxManager.triggerSkillImpact(boss.position, boss.faction, attack.damage);
  audioEngine.playSkill(boss.position);
}

function executeBasicAttack(
  boss: Bot,
  attack: BossAttackPattern,
  damageMult: number,
  gameState: GameState
): void {
  const damage = attack.damage * damageMult;
  const player = gameState.player;

  if (player && !player.isDead && !player.isInvulnerable) {
    const dx = player.position.x - boss.position.x;
    const dy = player.position.y - boss.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < attack.radius + player.radius) {
      player.currentHealth -= damage;
      player.statusEffects.damageFlash = 1;
      vfxManager.triggerDamageTaken(player.position, damage, 'boss');
    }
  }
}

function executeAOESlam(
  boss: Bot,
  attack: BossAttackPattern,
  damageMult: number,
  gameState: GameState
): void {
  const damage = attack.damage * damageMult;

  // Damage all entities in radius
  const entities = [gameState.player, ...gameState.bots].filter(
    (e) => e && !e.isDead && e.id !== boss.id
  );

  entities.forEach((entity) => {
    const dx = entity.position.x - boss.position.x;
    const dy = entity.position.y - boss.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < attack.radius) {
      if (!entity.isInvulnerable && entity.statusEffects.invulnerable <= 0) {
        entity.currentHealth -= damage;
        entity.statusEffects.damageFlash = 1;

        // Knockback
        if (dist > 0) {
          const knockbackForce = 15;
          entity.velocity.x += (dx / dist) * knockbackForce;
          entity.velocity.y += (dy / dist) * knockbackForce;
        }
      }
    }
  });

  // VFX
  gameState.shakeIntensity = Math.max(gameState.shakeIntensity, 1.5);
}

function executeSummonMinions(boss: Bot, state: BossState, gameState: GameState): void {
  // Summon 4 elemental minions
  const factions = [Faction.Fire, Faction.Water, Faction.Metal, Faction.Wood];
  const cx = boss.position.x;
  const cy = boss.position.y;

  factions.forEach((faction, i) => {
    const angle = (i / 4) * Math.PI * 2;
    const dist = 150;

    const minion: Bot = {
      id: `boss-minion-${Date.now()}-${i}`,
      position: {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
      },
      velocity: { x: 0, y: 0 },
      radius: 35,
      color: '',
      isDead: false,
      trail: [],
      faction,
      name: `Minion`,
      score: 0,
      kills: 0,
      maxHealth: 50,
      currentHealth: 50,
      tier: 'Ấu Trùng' as any,
      targetPosition: { x: cx, y: cy },
      spawnTime: gameState.gameTime,
      acceleration: 1,
      maxSpeed: 5,
      friction: 0.93,
      isInvulnerable: false,
      skillCooldown: 0,
      maxSkillCooldown: 8,
      defense: 1,
      damageMultiplier: 1,
      mutations: [],
      critChance: 0,
      critMultiplier: 1.5,
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
        kingForm: 0,
      },
      rewindHistory: [],
      stationaryTime: 0,
      teleportCooldown: 0,
      landmarkCharge: 0,
      landmarkId: null,
      landmarkCooldown: 0,
      statusEffects: {
        speedBoost: 1,
        shielded: false,
        burning: false,
        burnTimer: 0,
        slowed: false,
        slowTimer: 0,
        slowMultiplier: 1,
        poisoned: false,
        poisonTimer: 0,
        regen: 0,
        airborne: false,
        stealthed: false,
        stealthCharge: 0,
        invulnerable: 0,
        rooted: 0,
        speedSurge: 0,
        kingForm: 0,
        damageBoost: 1,
        defenseBoost: 1,
        damageBoostTimer: 0,
        defenseBoostTimer: 0,
        shieldTimer: 0,
        speedBoostTimer: 0,
        critCharges: 0,
        visionBoost: 1,
        visionBoostTimer: 0,
        damageFlash: 0,
      },
      aiState: 'chase',
      targetEntityId: null,
      aiReactionTimer: 0,
      isCreep: true,
      isElite: true,
    };

    gameState.creeps.push(minion);
    state.summonedMinions.push(minion.id);
  });

  console.log('[Boss] Summoned 4 minions');
}

function executeElementalBarrage(
  boss: Bot,
  attack: BossAttackPattern,
  damageMult: number,
  gameState: GameState
): void {
  // Fire projectiles in 8 directions
  const projectileCount = 8;
  const damage = attack.damage * damageMult;

  for (let i = 0; i < projectileCount; i++) {
    const angle = (i / projectileCount) * Math.PI * 2;
    const speed = 12;

    gameState.projectiles.push({
      id: `boss-proj-${Date.now()}-${i}`,
      position: { ...boss.position },
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      },
      radius: 15,
      color: '#a855f7',
      isDead: false,
      trail: [],
      ownerId: boss.id,
      damage,
      type: 'ice',
      duration: 3,
    });
  }
}

function executeChargeAttack(
  boss: Bot,
  state: BossState,
  attack: BossAttackPattern,
  damageMult: number,
  gameState: GameState
): void {
  if (!state.targetPosition) return;

  // Dash toward target
  const dx = state.targetPosition.x - boss.position.x;
  const dy = state.targetPosition.y - boss.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0) {
    const chargeSpeed = 40;
    boss.velocity.x = (dx / dist) * chargeSpeed;
    boss.velocity.y = (dy / dist) * chargeSpeed;
  }
}

function executeMeteorShower(
  boss: Bot,
  attack: BossAttackPattern,
  damageMult: number,
  gameState: GameState
): void {
  // Create multiple hazards across the arena
  const meteorCount = 6;
  const cx = WORLD_WIDTH / 2;
  const cy = WORLD_HEIGHT / 2;

  for (let i = 0; i < meteorCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 600;

    gameState.hazards.push({
      id: `meteor-${Date.now()}-${i}`,
      type: 'lightning',
      position: {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
      },
      radius: attack.radius,
      timer: 1 + Math.random() * 2,
      duration: 0.5,
      active: false,
    });
  }
}

function executeVoidZone(
  boss: Bot,
  state: BossState,
  attack: BossAttackPattern,
  damageMult: number,
  gameState: GameState
): void {
  // Create lava zone at target position
  if (state.targetPosition) {
    gameState.lavaZones.push({
      id: `void-${Date.now()}`,
      position: { ...state.targetPosition },
      radius: attack.radius,
      damage: attack.damage * damageMult,
      ownerId: boss.id,
      life: attack.duration,
    });
  }
}

function updateOngoingAttack(
  boss: Bot,
  state: BossState,
  gameState: GameState,
  dt: number
): void {
  // Handle ongoing effects for certain attacks
  if (state.currentAttack === BossAttackType.LaserSweep) {
    // Laser sweep logic - rotate and damage
    // This would need more complex implementation
  }
}

// ============================================
// MOVEMENT LOGIC
// ============================================

function updateBossMovement(
  boss: Bot,
  state: BossState,
  gameState: GameState,
  dt: number
): void {
  const player = gameState.player;
  if (!player || player.isDead) return;

  const phaseConfig = BOSS_PHASES.find((p) => p.phase === state.currentPhase);
  const speedMult = phaseConfig?.speedMultiplier || 1;

  // Move toward player if not attacking
  if (!state.currentAttack || state.attackChargeTime > 0) {
    const dx = player.position.x - boss.position.x;
    const dy = player.position.y - boss.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 200) {
      // Move closer
      const baseSpeed = 3 * speedMult;
      boss.velocity.x += (dx / dist) * baseSpeed * dt * 60;
      boss.velocity.y += (dy / dist) * baseSpeed * dt * 60;
    }
  }

  // Apply friction
  boss.velocity.x *= 0.95;
  boss.velocity.y *= 0.95;

  // Update position
  boss.position.x += boss.velocity.x;
  boss.position.y += boss.velocity.y;

  // Constrain to center area
  const cx = WORLD_WIDTH / 2;
  const cy = WORLD_HEIGHT / 2;
  const maxDist = 800;
  const distFromCenter = Math.sqrt((boss.position.x - cx) ** 2 + (boss.position.y - cy) ** 2);

  if (distFromCenter > maxDist) {
    const angle = Math.atan2(boss.position.y - cy, boss.position.x - cx);
    boss.position.x = cx + Math.cos(angle) * maxDist;
    boss.position.y = cy + Math.sin(angle) * maxDist;
  }
}

// ============================================
// BOSS DEFEAT
// ============================================

export function onBossDefeated(boss: Bot, gameState: GameState): void {
  // Drop legendary loot
  gameState.powerUps.push({
    id: `legendary-orb-${Date.now()}`,
    position: { ...boss.position },
    velocity: { x: 0, y: 0 },
    radius: 25,
    color: '#fbbf24',
    isDead: false,
    trail: [],
    type: 'legendary_orb',
    duration: 60,
  });

  // VFX
  vfxManager.triggerDeathBurst(boss.position, boss.faction, boss.radius);

  // Message
  gameState.floatingTexts.push({
    id: Math.random().toString(),
    position: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 - 150 },
    text: 'CỔ TRÙNG MẪU DEFEATED!',
    color: '#22c55e',
    size: 48,
    life: 5,
    velocity: { x: 0, y: 0 },
  });

  // Clean up state
  bossStates.delete(boss.id);

  console.log('[Boss] DEFEATED!');
}

// ============================================
// EXPORTS
// ============================================

export { BOSS_PHASES, BOSS_ATTACK_PATTERNS };
