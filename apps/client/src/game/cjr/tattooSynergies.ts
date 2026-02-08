import { Player, GameState, Food, Entity } from '@/types';
import { TattooId } from './cjrTypes';
import { createFood, createParticle } from '../engine/factories';
import { createFloatingText } from '../engine/effects';
import { StatusFlag, TattooFlag } from '../engine/statusFlags';
import { vfxSystem } from '../vfx/vfxSystem';
import { TransformAccess, PhysicsAccess } from '@cjr/engine';
import { getWorld } from '../engine/context';

// EIDOLON-V: DOD helpers for tattoo synergies
const getPlayerPos = (player: Player, out: { x: number; y: number }) => {
  if (player.physicsIndex !== undefined) {
    const w = getWorld();
    const idx = player.physicsIndex * 8;
    out.x = w.transform[idx];
    out.y = w.transform[idx + 1];
  } else {
    out.x = player.position.x;
    out.y = player.position.y;
  }
};

const getPlayerVel = (player: Player, out: { x: number; y: number }) => {
  if (player.physicsIndex !== undefined) {
    const w = getWorld();
    const idx = player.physicsIndex * 8;
    out.x = w.physics[idx];
    out.y = w.physics[idx + 1];
  } else {
    out.x = player.velocity.x;
    out.y = player.velocity.y;
  }
};

const getFoodPos = (food: Food, out: { x: number; y: number }) => {
  if (food.physicsIndex !== undefined) {
    const w = getWorld();
    const idx = food.physicsIndex * 8;
    out.x = w.transform[idx];
    out.y = w.transform[idx + 1];
  } else {
    out.x = food.position.x;
    out.y = food.position.y;
  }
};

const setFoodVel = (food: Food, vx: number, vy: number) => {
  if (food.physicsIndex !== undefined) {
    const w = getWorld();
    const idx = food.physicsIndex * 8;
    w.physics[idx] = vx;
    w.physics[idx + 1] = vy;
  }
  // Keep object in sync for legacy
  food.velocity.x = vx;
  food.velocity.y = vy;
};

// ============================================
// SYNERGY VISUAL EFFECTS HELPER
// ============================================

const createSynergyVisualEffect = (
  player: Player,
  config: {
    particleColor: string;
    particleCount: number;
    pattern: 'fusion' | 'explosion' | 'spiral' | 'geometric';
    duration: number;
  },
  state: GameState
): void => {
  // EIDOLON-V: Read position from DOD
  const pos = { x: 0, y: 0 };
  getPlayerPos(player, pos);

  // EIDOLON-V: Push Synergy Event (Type 8)
  const meta = `${config.particleColor}:${config.pattern}:${config.particleCount}:${config.duration}`;
  vfxSystem.emitVFX(state, 8, pos.x, pos.y, 0, meta);
};

// ============================================
// TATTOO SYNERGY DEFINITIONS - Strategic Combinations
// ============================================

interface TattooSynergy {
  id: string;
  name: string;
  tattoos: TattooId[]; // Support 2-4 tattoos
  description: string;
  tier: 'basic' | 'advanced' | 'master' | 'legendary';
  effect: (player: Player, state: GameState) => void;
  visualEffect: {
    particleColor: string;
    particleCount: number;
    pattern: 'fusion' | 'explosion' | 'spiral' | 'geometric';
    duration: number;
  };
  unlockRequirement: {
    minPlayerLevel?: number;
    minMatchPercent?: number;
    specificSituation?: string;
  };
  cooldown: number; // Global cooldown for this synergy
}

const TATTOO_SYNERGIES: TattooSynergy[] = [
  // BASIC SYNERGIES (Easy to discover)
  {
    id: 'purification_mastery',
    name: 'Purification Mastery',
    tattoos: [TattooId.FilterInk, TattooId.NeutralMastery],
    description: 'Neutral pickups now cleanse wrong pigments and provide bonus mass',
    tier: 'basic',
    effect: (player, state) => {
      // Apply purification effect
      player.tattooFlags |= TattooFlag.NEUTRAL_PURIFICATION;
      player.statusMultipliers.neutralMass = 1.5; // Enhanced from 1.25
      player.statusScalars.purificationRadius = 150;

      // Create visual effect
      createSynergyVisualEffect(
        player,
        {
          particleColor: '#E1BEE7',
          particleCount: 30,
          pattern: 'fusion',
          duration: 2.0,
        },
        state
      );
    },
    visualEffect: {
      particleColor: '#E1BEE7',
      particleCount: 30,
      pattern: 'fusion',
      duration: 2.0,
    },
    unlockRequirement: {
      minPlayerLevel: 1,
    },
    cooldown: 5.0,
  },

  {
    id: 'explosive_speed',
    name: 'Explosive Speed',
    tattoos: [TattooId.Overdrive, TattooId.PigmentBomb],
    description: 'Overdrive attacks create color explosions and gain speed',
    tier: 'basic',
    effect: (player, state) => {
      // Apply explosive speed effect
      player.tattooFlags |= TattooFlag.OVERDRIVE_EXPLOSIVE;
      player.statusMultipliers.explosiveSpeed = 1.3;
      player.statusScalars.explosionRadius = 100;

      createSynergyVisualEffect(
        player,
        {
          particleColor: '#FF6B35',
          particleCount: 40,
          pattern: 'explosion',
          duration: 1.5,
        },
        state
      );
    },
    visualEffect: {
      particleColor: '#FF6B35',
      particleCount: 40,
      pattern: 'explosion',
      duration: 1.5,
    },
    unlockRequirement: {
      minPlayerLevel: 2,
    },
    cooldown: 6.0,
  },

  // ADVANCED SYNERGIES (Require strategic thinking)
  {
    id: 'golden_attraction',
    name: 'Golden Attraction',
    tattoos: [TattooId.PerfectMatch, TattooId.CatalystSense],
    description: 'Perfect matches create golden magnetic fields that attract catalysts',
    tier: 'advanced',
    effect: (player, state) => {
      // Apply golden attraction effect
      player.tattooFlags |= TattooFlag.GOLDEN_ATTRACTION;
      player.statusScalars.catalystAttractionRadius = 300;
      player.statusMultipliers.goldenMagneticForce = 2.0;

      // Attract nearby catalysts
      const pPos = { x: 0, y: 0 };
      getPlayerPos(player, pPos);
      state.food.forEach(food => {
        if (food.isDead || food.kind !== 'catalyst') return;
        const fPos = { x: 0, y: 0 };
        getFoodPos(food, fPos);
        const dist = Math.hypot(fPos.x - pPos.x, fPos.y - pPos.y);
        const attrRadius = player.statusScalars.catalystAttractionRadius || 0;
        if (dist < attrRadius) {
          const force = (player.statusMultipliers.goldenMagneticForce || 0) * 50;
          const dx = pPos.x - fPos.x;
          const dy = pPos.y - fPos.y;
          const newVx = food.velocity.x + (dx / dist) * force;
          const newVy = food.velocity.y + (dy / dist) * force;
          setFoodVel(food, newVx, newVy);
        }
      });

      createSynergyVisualEffect(
        player,
        {
          particleColor: '#FFD700',
          particleCount: 50,
          pattern: 'spiral',
          duration: 2.5,
        },
        state
      );
    },
    visualEffect: {
      particleColor: '#FFD700',
      particleCount: 50,
      pattern: 'spiral',
      duration: 2.5,
    },
    unlockRequirement: {
      minMatchPercent: 0.85,
    },
    cooldown: 8.0,
  },

  {
    id: 'elemental_balance',
    name: 'Elemental Balance',
    tattoos: [TattooId.SolventExpert, TattooId.DepositShield],
    description: 'Solvent creates protective shields while shields enhance solvent power',
    tier: 'advanced',
    effect: (player, state) => {
      // Apply elemental balance
      player.tattooFlags |= TattooFlag.ELEMENTAL_BALANCE;
      player.statusScalars.solventShieldPower = 2.5; // Enhanced from 2.0
      player.tattooFlags |= TattooFlag.SHIELD_SOLVENT_SYNERGY;

      createSynergyVisualEffect(
        player,
        {
          particleColor: '#00BCD4',
          particleCount: 45,
          pattern: 'geometric',
          duration: 2.8,
        },
        state
      );
    },
    visualEffect: {
      particleColor: '#00BCD4',
      particleCount: 45,
      pattern: 'geometric',
      duration: 2.8,
    },
    unlockRequirement: {
      minPlayerLevel: 3,
    },
    cooldown: 7.0,
  },

  {
    id: 'prismatic_bulwark',
    name: 'Prismatic Bulwark',
    tattoos: [TattooId.PrismGuard, TattooId.DepositShield],
    description: 'Perfect guard window grants a stronger shield and a short speed burst',
    tier: 'advanced',
    effect: (player, state) => {
      player.statusFlags |= StatusFlag.SHIELDED;
      player.statusScalars.commitShield = Math.max(player.statusScalars.commitShield || 0, 4.0);
      player.statusMultipliers.speed = Math.max(player.statusMultipliers.speed || 1, 1.15);
      player.statusTimers.tempSpeed = Math.max(player.statusTimers.tempSpeed || 0, 3.5);

      createSynergyVisualEffect(
        player,
        {
          particleColor: '#F59E0B',
          particleCount: 40,
          pattern: 'geometric',
          duration: 2.2,
        },
        state
      );
    },
    visualEffect: {
      particleColor: '#F59E0B',
      particleCount: 40,
      pattern: 'geometric',
      duration: 2.2,
    },
    unlockRequirement: {
      minPlayerLevel: 3,
    },
    cooldown: 8.0,
  },

  {
    id: 'catalyst_surge',
    name: 'Catalyst Surge',
    tattoos: [TattooId.CatalystEcho, TattooId.PerfectMatch],
    description: 'Perfect matches surge color focus and pull nearby catalysts',
    tier: 'advanced',
    effect: (player, state) => {
      player.statusMultipliers.colorBoost = Math.max(player.statusMultipliers.colorBoost || 1, 1.8);
      player.statusTimers.colorBoost = Math.max(player.statusTimers.colorBoost || 0, 4.0);
      player.magneticFieldRadius = Math.max(player.magneticFieldRadius || 0, 180);
      player.statusTimers.magnet = Math.max(player.statusTimers.magnet || 0, 3.0);

      state.food.forEach(food => {
        if (food.isDead || food.kind !== 'catalyst') return;
        const pPos = { x: 0, y: 0 };
        const fPos = { x: 0, y: 0 };
        getPlayerPos(player, pPos);
        getFoodPos(food, fPos);
        const dx = pPos.x - fPos.x;
        const dy = pPos.y - fPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 220 && dist > 1) {
          const force = 120;
          const newVx = food.velocity.x + (dx / dist) * force;
          const newVy = food.velocity.y + (dy / dist) * force;
          setFoodVel(food, newVx, newVy);
        }
      });

      createSynergyVisualEffect(
        player,
        {
          particleColor: '#10B981',
          particleCount: 45,
          pattern: 'spiral',
          duration: 2.4,
        },
        state
      );
    },
    visualEffect: {
      particleColor: '#10B981',
      particleCount: 45,
      pattern: 'spiral',
      duration: 2.4,
    },
    unlockRequirement: {
      minMatchPercent: 0.82,
    },
    cooldown: 10.0,
  },

  // MASTER SYNERGIES (High skill requirement)
  {
    id: 'chromatic_mastery',
    name: 'Chromatic Mastery',
    tattoos: [TattooId.FilterInk, TattooId.PerfectMatch, TattooId.CatalystSense],
    description: 'Perfect matches grant temporary color immunity and massive catalyst attraction',
    tier: 'master',
    effect: (player, state) => {
      // Apply chromatic mastery
      player.tattooFlags |= TattooFlag.COLOR_IMMUNITY;
      player.statusTimers.chromaticImmunity = 5.0;
      player.statusMultipliers.perfectMatch = 2.0; // Enhanced from 1.5
      player.statusScalars.catalystMasteryRadius = 500;
      createSynergyVisualEffect(
        player,
        {
          particleColor: '#9C27B0',
          particleCount: 80,
          pattern: 'geometric',
          duration: 4.0,
        },
        state
      );
      createFloatingText(player.position, 'CHROMATIC MASTERY!', '#9C27B0', 28, state);
    },
    visualEffect: {
      particleColor: '#9C27B0',
      particleCount: 80,
      pattern: 'geometric',
      duration: 4.0,
    },
    unlockRequirement: {
      minMatchPercent: 0.95,
    },
    cooldown: 15.0,
  },

  {
    id: 'kinetic_explosion',
    name: 'Kinetic Explosion',
    tattoos: [TattooId.Overdrive, TattooId.PigmentBomb, TattooId.DepositShield],
    description: 'Overdrive attacks through shields create massive kinetic explosions',
    tier: 'master',
    effect: (player, state) => {
      // Apply kinetic explosion
      player.tattooFlags |= TattooFlag.KINETIC_EXPLOSION;
      player.statusMultipliers.explosionDamage = 2.0;
      player.tattooFlags |= TattooFlag.SHIELD_PIERCING;

      createSynergyVisualEffect(
        player,
        {
          particleColor: '#FF5722',
          particleCount: 100,
          pattern: 'explosion',
          duration: 3.5,
        },
        state
      );
      createFloatingText(player.position, 'KINETIC EXPLOSION!', '#FF5722', 32, state);
    },
    visualEffect: {
      particleColor: '#FF5722',
      particleCount: 100,
      pattern: 'explosion',
      duration: 3.5,
    },
    unlockRequirement: {
      minPlayerLevel: 5,
    },
    cooldown: 12.0,
  },

  {
    id: 'absolute_mastery',
    name: 'Absolute Mastery',
    tattoos: [
      TattooId.PerfectMatch,
      TattooId.CatalystSense,
      TattooId.FilterInk,
      TattooId.NeutralMastery,
    ],
    description: 'Unlock the full potential of color manipulation with god-like control',
    tier: 'legendary',
    effect: (player, state) => {
      // Apply absolute mastery
      player.tattooFlags |= TattooFlag.ABSOLUTE_MASTERY;
      player.statusScalars.colorControl = 1.0; // Full control
      player.statusScalars.perfectMatchThreshold = 0.7; // Lowered from 0.85
      player.tattooFlags |= TattooFlag.CATALYST_GUARANTEE; // Always get catalysts
      player.tattooFlags |= TattooFlag.NEUTRAL_GOD_MODE; // Neutral becomes super

      createSynergyVisualEffect(
        player,
        {
          particleColor: '#FFD700',
          particleCount: 150,
          pattern: 'geometric',
          duration: 5.0,
        },
        state
      );
      createFloatingText(player.position, 'ABSOLUTE MASTERY!', '#FFD700', 36, state);
    },
    visualEffect: {
      particleColor: '#FFD700',
      particleCount: 150,
      pattern: 'geometric',
      duration: 5.0,
    },
    unlockRequirement: {
      minMatchPercent: 0.98,
    },
    cooldown: 30.0,
  },

  {
    id: 'temporal_distortion',
    name: 'Temporal Distortion',
    tattoos: [TattooId.Overdrive, TattooId.SolventExpert, TattooId.PigmentBomb],
    description: 'Manipulate time itself with speed boosts and temporal effects',
    tier: 'legendary',
    effect: (player, state) => {
      // Apply temporal distortion
      player.tattooFlags |= TattooFlag.TEMPORAL_DISTORTION;
      player.statusScalars.timeManipulation = 0.5; // 50% time slow
      player.statusMultipliers.speedAmplifier = 3.0;
      player.statusMultipliers.explosionTimeDilation = 2.0;

      createSynergyVisualEffect(
        player,
        {
          particleColor: '#E91E63',
          particleCount: 120,
          pattern: 'spiral',
          duration: 4.5,
        },
        state
      );
      createFloatingText(player.position, 'TEMPORAL DISTORTION!', '#E91E63', 34, state);
    },
    visualEffect: {
      particleColor: '#E91E63',
      particleCount: 120,
      pattern: 'spiral',
      duration: 4.5,
    },
    unlockRequirement: {
      minPlayerLevel: 8,
    },
    cooldown: 25.0,
  },
];

// ============================================
// TATTOO SYNERGY MANAGER
// ============================================

export class TattooSynergyManager {
  private activeSynergies: Map<string, TattooSynergyEffect> = new Map();
  private synergyCooldowns: Map<string, number> = new Map();
  private discoveredSynergies: Set<string> = new Set();
  private synergyStats: Map<string, number> = new Map();

  constructor() {
    // Initialize with basic synergies discovered
    this.discoveredSynergies.add('purification_mastery');
    this.discoveredSynergies.add('explosive_speed');
  }

  /**
   * Check for and activate tattoo synergies
   */
  checkSynergies(player: Player, state: GameState): void {
    const playerTattoos = player.tattoos;

    // Check each possible synergy
    for (const synergy of TATTOO_SYNERGIES) {
      // Skip if already on cooldown
      if (this.isSynergyOnCooldown(synergy.id)) continue;

      // Check if player has required tattoos
      if (this.hasRequiredTattoos(playerTattoos, synergy.tattoos)) {
        // Check unlock requirements
        if (this.meetsUnlockRequirements(player, synergy)) {
          this.activateSynergy(player, synergy, state);
        }
      }
    }
  }

  /**
   * Check if player has required tattoos
   */
  private hasRequiredTattoos(playerTattoos: TattooId[], requiredTattoos: TattooId[]): boolean {
    return requiredTattoos.every(tattoo => playerTattoos.includes(tattoo));
  }

  /**
   * Check if unlock requirements are met
   */
  private meetsUnlockRequirements(player: Player, synergy: TattooSynergy): boolean {
    const req = synergy.unlockRequirement;

    if (req.minPlayerLevel && player.radius < 15 + req.minPlayerLevel * 5) return false;
    if (req.minMatchPercent && player.matchPercent < req.minMatchPercent) return false;
    if (req.specificSituation && !this.isInSpecificSituation(player, req.specificSituation))
      return false;

    return true;
  }

  /**
   * Check if player is in specific situation
   */
  private isInSpecificSituation(player: Player, situation: string): boolean {
    switch (situation) {
      case 'in_combat':
        return player.lastHitTime < 1.0;
      case 'high_speed': {
        const vel = { x: 0, y: 0 };
        getPlayerVel(player, vel);
        const speed = Math.hypot(vel.x, vel.y);
        return speed > 300;
      }
      case 'low_health':
        return player.currentHealth < player.maxHealth * 0.3;
      default:
        return true;
    }
  }

  /**
   * Activate a tattoo synergy
   */
  private activateSynergy(player: Player, synergy: TattooSynergy, state: GameState): void {
    // Apply synergy effect
    synergy.effect(player, state);

    // Track synergy
    const effectId = `${player.id}_${synergy.id}`;
    const effect: TattooSynergyEffect = {
      id: effectId,
      synergyId: synergy.id,
      playerId: player.id,
      elapsed: 0,
      duration: this.getSynergyDuration(synergy),
      tier: synergy.tier,
    };

    this.activeSynergies.set(effectId, effect);

    // Set cooldown
    this.synergyCooldowns.set(synergy.id, synergy.cooldown);

    // Mark as discovered
    this.discoveredSynergies.add(synergy.id);

    // Update stats
    const currentCount = this.synergyStats.get(synergy.id) || 0;
    this.synergyStats.set(synergy.id, currentCount + 1);

    // Create notification
    this.createSynergyNotification(player, synergy, state);
  }

  /**
   * Get synergy duration based on tier
   */
  private getSynergyDuration(synergy: TattooSynergy): number {
    switch (synergy.tier) {
      case 'basic':
        return 10.0;
      case 'advanced':
        return 15.0;
      case 'master':
        return 20.0;
      case 'legendary':
        return 30.0;
      default:
        return 10.0;
    }
  }

  /**
   * Check if synergy is on cooldown
   */
  private isSynergyOnCooldown(synergyId: string): boolean {
    const cooldown = this.synergyCooldowns.get(synergyId) || 0;
    return cooldown > 0;
  }

  /**
   * Update active synergies and cooldowns
   */
  updateSynergies(state: GameState, dt: number): void {
    // Update cooldowns
    for (const [synergyId, cooldown] of this.synergyCooldowns.entries()) {
      const newCooldown = Math.max(0, cooldown - dt);
      if (newCooldown === 0) {
        this.synergyCooldowns.delete(synergyId);
      } else {
        this.synergyCooldowns.set(synergyId, newCooldown);
      }
    }

    // Update active synergies
    for (const [effectId, effect] of this.activeSynergies.entries()) {
      effect.elapsed += dt;
      if (effect.elapsed >= effect.duration) {
        this.activeSynergies.delete(effectId);

        // Remove synergy effects from player
        this.removeSynergyEffects(effect.playerId, effect.synergyId, state);
      }
    }
  }

  reset(): void {
    this.activeSynergies.clear();
    this.synergyCooldowns.clear();
    this.synergyStats.clear();
    this.discoveredSynergies.clear();
    this.discoveredSynergies.add('purification_mastery');
    this.discoveredSynergies.add('explosive_speed');
  }

  /**
   * Remove synergy effects from player
   */
  private removeSynergyEffects(playerId: string, synergyId: string, state: GameState): void {
    const player =
      state.player.id === playerId ? state.player : state.bots.find(b => b.id === playerId);
    if (!player) return;

    // Remove all synergy effects
    // EIDOLON-V FIX: Reset flags and values instead of delete
    player.tattooFlags &= ~TattooFlag.NEUTRAL_PURIFICATION;
    player.statusMultipliers.neutralMass = 1; // Reset to 1 (Multipliers default)
    player.statusScalars.purificationRadius = 0;

    player.tattooFlags &= ~TattooFlag.OVERDRIVE_EXPLOSIVE;
    player.statusMultipliers.explosiveSpeed = 1;
    player.statusScalars.explosionRadius = 0;

    player.tattooFlags &= ~TattooFlag.GOLDEN_ATTRACTION;
    player.statusScalars.catalystAttractionRadius = 0;
    player.statusMultipliers.goldenMagneticForce = 0; // Value or mult? Logic was `* (value || 0)`. So 0.

    player.tattooFlags &= ~TattooFlag.ELEMENTAL_BALANCE;
    player.statusScalars.solventShieldPower = 0;
    player.tattooFlags &= ~TattooFlag.SHIELD_SOLVENT_SYNERGY;

    player.tattooFlags &= ~TattooFlag.COLOR_IMMUNITY;
    player.statusTimers.chromaticImmunity = 0;
    player.statusMultipliers.perfectMatch = 1;
    player.statusScalars.catalystMasteryRadius = 0;

    player.tattooFlags &= ~TattooFlag.CATALYST_GUARANTEE;
    player.tattooFlags &= ~TattooFlag.NEUTRAL_GOD_MODE;

    player.tattooFlags &= ~TattooFlag.KINETIC_EXPLOSION;
    player.statusMultipliers.explosionDamage = 1;
    player.tattooFlags &= ~TattooFlag.SHIELD_PIERCING;

    player.tattooFlags &= ~TattooFlag.ABSOLUTE_MASTERY;
    player.statusScalars.colorControl = 0;
    player.statusScalars.perfectMatchThreshold = 0.8; // Reset to default

    player.tattooFlags &= ~TattooFlag.TEMPORAL_DISTORTION;
    player.statusScalars.timeManipulation = 0;
    player.statusMultipliers.speedAmplifier = 0; // Logic `* (amp || 0)` or `1`? Default should be safe.
    player.statusMultipliers.explosionTimeDilation = 0;

    // Reset Scalars that don't have explicit flags but were modified
    // EIDOLON-V: Decay handles tempSpeed naturally via statusTimers
    // Actually Logic handles tempSpeedBoost decay, so force reset might interfere if multiple buffs stack?
    // For now, assume synergies handle their own resets or rely on decay.
    // Ideally we should subtract, but "delete" implies full removal.
    // We'll leave shared scalars to decay logic if they are timed.
  }

  /**
   * Create notification for synergy activation
   */
  private createSynergyNotification(
    player: Player,
    synergy: TattooSynergy,
    state: GameState
  ): void {
    const tierEmoji = {
      basic: '⭐',
      advanced: '⭐⭐',
      master: '⭐⭐⭐',
      legendary: '⭐⭐⭐⭐',
    };

    const message = `${tierEmoji[synergy.tier]} ${synergy.name}`;
    const pos = { x: 0, y: 0 };
    getPlayerPos(player, pos);
    createFloatingText(pos, message, synergy.visualEffect.particleColor, 24, state);
  }

  /**
   * Get synergy information for UI
   */
  getSynergyInfo(tattoos: TattooId[]): TattooSynergy[] {
    return TATTOO_SYNERGIES.filter(
      synergy => tattoos.length >= 2 && synergy.tattoos.every(tattoo => tattoos.includes(tattoo))
    );
  }

  /**
   * Get discovered synergies
   */
  getDiscoveredSynergies(): TattooSynergy[] {
    return TATTOO_SYNERGIES.filter(synergy => this.discoveredSynergies.has(synergy.id));
  }

  /**
   * Get synergy statistics
   */
  getSynergyStats(): Map<string, number> {
    return new Map(this.synergyStats);
  }

  /**
   * Check if player has any active synergies
   */
  hasActiveSynergies(playerId: string): boolean {
    for (const [effectId, effect] of this.activeSynergies.entries()) {
      if (effect.playerId === playerId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get active synergies for player
   */
  getActiveSynergies(playerId: string): TattooSynergyEffect[] {
    const effects: TattooSynergyEffect[] = [];

    for (const [effectId, effect] of this.activeSynergies.entries()) {
      if (effect.playerId === playerId) {
        effects.push(effect);
      }
    }

    return effects;
  }

  /**
   * EIDOLON-V FIX: Cleanup all synergies for a specific entity
   * Called when entity dies or is deactivated to prevent ID recycling bugs
   */
  cleanupEntity(playerId: string): void {
    // Find all effects for this player
    const toRemove: string[] = [];
    for (const [effectId, effect] of this.activeSynergies.entries()) {
      if (effect.playerId === playerId) {
        toRemove.push(effectId);
      }
    }

    // Remove them
    toRemove.forEach(effectId => {
      this.activeSynergies.delete(effectId);
    });

    // Note: We don't need to call removeSynergyEffects() because the entity is dead/resetting anyway.
    // The flags/stats on the entity object will be reset by the ObjectPool or Factory.
    // We just need to clear the Manager's references.
  }
}

// ============================================
// TYPE DEFINITIONS
// ============================================

interface TattooSynergyEffect {
  id: string;
  synergyId: string;
  playerId: string;
  elapsed: number;
  duration: number;
  tier: 'basic' | 'advanced' | 'master' | 'legendary';
}

// ============================================
// GLOBAL TATTOO SYNERGY MANAGER
// ============================================

export const tattooSynergyManager = new TattooSynergyManager();
