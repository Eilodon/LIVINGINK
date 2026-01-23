/**
 * GU-KING VFX MANAGER
 *
 * Production-quality visual effects system
 * Features:
 * - Hit confirmation with screen shake
 * - Kill celebration with slow-mo
 * - Evolution metamorphosis
 * - Skill telegraph
 * - Zone-specific particles
 *
 * Best practices from: Hades, Vampire Survivors, Dead Cells
 */

import type { GameState, Player, Bot, Faction, Vector2 } from '../../types';
import { FACTION_CONFIG } from '../../constants';

// ============================================
// TYPES
// ============================================

export interface VFXConfig {
  intensity: 'low' | 'medium' | 'high' | 'ultra';
  screenShake: boolean;
  particles: boolean;
  slowMotion: boolean;
  colorFlash: boolean;
}

export interface VFXEvent {
  type: VFXEventType;
  position: Vector2;
  data?: any;
  duration: number;
  elapsed: number;
}

export type VFXEventType =
  | 'hit_confirm'
  | 'kill_celebration'
  | 'death_burst'
  | 'evolution_transform'
  | 'skill_telegraph'
  | 'skill_impact'
  | 'damage_taken'
  | 'heal_received'
  | 'zone_enter'
  | 'relic_pickup'
  | 'king_crown'
  | 'round_change'
  | 'boss_spawn'
  | 'legendary_evolution';

export interface ParticleConfig {
  count: number;
  color: string | string[];
  speed: number;
  speedVariance: number;
  size: number;
  sizeVariance: number;
  life: number;
  lifeVariance: number;
  gravity: number;
  drag: number;
  fadeOut: boolean;
  glow: boolean;
  style: 'dot' | 'ring' | 'line' | 'spark' | 'trail';
}

export interface ScreenEffect {
  type: 'shake' | 'flash' | 'vignette' | 'zoom' | 'chromatic' | 'slowmo';
  intensity: number;
  duration: number;
  elapsed: number;
  color?: string;
}

// ============================================
// PARTICLE PRESETS
// ============================================

export const PARTICLE_PRESETS: Record<string, Partial<ParticleConfig>> = {
  // Hit effects
  hit_sparks: {
    count: 8,
    color: ['#ffffff', '#fbbf24', '#f97316'],
    speed: 8,
    speedVariance: 4,
    size: 3,
    life: 0.3,
    gravity: 0,
    drag: 0.95,
    style: 'spark',
    glow: true,
  },

  // Kill celebration
  kill_burst: {
    count: 30,
    color: ['#22c55e', '#4ade80', '#86efac'],
    speed: 12,
    speedVariance: 6,
    size: 5,
    sizeVariance: 3,
    life: 0.8,
    gravity: -2,
    drag: 0.92,
    style: 'ring',
    fadeOut: true,
    glow: true,
  },

  // Death explosion
  death_explosion: {
    count: 50,
    speed: 15,
    speedVariance: 8,
    size: 4,
    sizeVariance: 2,
    life: 1.2,
    gravity: 3,
    drag: 0.88,
    style: 'dot',
    fadeOut: true,
  },

  // Evolution particles
  evolution_aura: {
    count: 40,
    color: ['#a855f7', '#c084fc', '#e879f9'],
    speed: 3,
    speedVariance: 2,
    size: 6,
    life: 1.5,
    gravity: -5,
    drag: 0.98,
    style: 'ring',
    fadeOut: true,
    glow: true,
  },

  // Skill telegraph
  skill_ring: {
    count: 16,
    speed: 0,
    size: 2,
    life: 0.5,
    gravity: 0,
    drag: 1,
    style: 'line',
  },

  // Zone particles
  fire_embers: {
    count: 3,
    color: ['#f97316', '#fb923c', '#fbbf24'],
    speed: 2,
    speedVariance: 1,
    size: 2,
    life: 2,
    gravity: -3,
    drag: 0.99,
    style: 'dot',
    fadeOut: true,
    glow: true,
  },

  water_bubbles: {
    count: 2,
    color: ['#0ea5e9', '#38bdf8', '#7dd3fc'],
    speed: 1,
    speedVariance: 0.5,
    size: 4,
    life: 3,
    gravity: -1,
    drag: 0.995,
    style: 'ring',
    fadeOut: true,
  },

  metal_sparks: {
    count: 2,
    color: ['#e2e8f0', '#94a3b8', '#64748b'],
    speed: 6,
    speedVariance: 3,
    size: 2,
    life: 0.4,
    gravity: 2,
    drag: 0.9,
    style: 'spark',
    glow: true,
  },

  wood_leaves: {
    count: 2,
    color: ['#22c55e', '#4ade80', '#16a34a'],
    speed: 2,
    speedVariance: 1,
    size: 5,
    life: 4,
    gravity: 1,
    drag: 0.98,
    style: 'dot',
    fadeOut: true,
  },

  earth_dust: {
    count: 3,
    color: ['#a16207', '#ca8a04', '#eab308'],
    speed: 3,
    speedVariance: 2,
    size: 3,
    life: 1.5,
    gravity: 2,
    drag: 0.95,
    style: 'dot',
    fadeOut: true,
  },

  // Soul essence
  soul_essence: {
    count: 8,
    color: ['#c084fc', '#a855f7', '#9333ea'],
    speed: 4,
    speedVariance: 2,
    size: 4,
    life: 1,
    gravity: -6,
    drag: 0.9,
    style: 'trail',
    fadeOut: true,
    glow: true,
  },

  // Legendary evolution
  legendary_burst: {
    count: 100,
    color: ['#fbbf24', '#f59e0b', '#d97706', '#ffffff'],
    speed: 20,
    speedVariance: 10,
    size: 6,
    sizeVariance: 4,
    life: 2,
    gravity: -3,
    drag: 0.85,
    style: 'ring',
    fadeOut: true,
    glow: true,
  },
};

// ============================================
// SCREEN EFFECT PRESETS
// ============================================

export const SCREEN_EFFECT_PRESETS: Record<string, Partial<ScreenEffect>> = {
  hit_shake: {
    type: 'shake',
    intensity: 3,
    duration: 0.1,
  },

  kill_shake: {
    type: 'shake',
    intensity: 8,
    duration: 0.2,
  },

  death_shake: {
    type: 'shake',
    intensity: 15,
    duration: 0.4,
  },

  damage_flash: {
    type: 'flash',
    intensity: 0.3,
    duration: 0.15,
    color: '#ef4444',
  },

  heal_flash: {
    type: 'flash',
    intensity: 0.2,
    duration: 0.2,
    color: '#22c55e',
  },

  evolution_zoom: {
    type: 'zoom',
    intensity: 1.2,
    duration: 0.5,
  },

  kill_slowmo: {
    type: 'slowmo',
    intensity: 0.3,
    duration: 0.3,
  },

  boss_chromatic: {
    type: 'chromatic',
    intensity: 5,
    duration: 1,
  },

  zone_vignette: {
    type: 'vignette',
    intensity: 0.4,
    duration: 0.5,
  },
};

// ============================================
// VFX MANAGER CLASS
// ============================================

export class VFXManager {
  private config: VFXConfig;
  private activeEvents: VFXEvent[] = [];
  private screenEffects: ScreenEffect[] = [];
  private timeScale: number = 1;

  // Callbacks for rendering
  private onSpawnParticles: ((preset: Partial<ParticleConfig>, position: Vector2, color?: string) => void) | null = null;
  private onScreenEffect: ((effect: ScreenEffect) => void) | null = null;
  private onFloatingText: ((position: Vector2, text: string, color: string, size: number) => void) | null = null;

  constructor(config: Partial<VFXConfig> = {}) {
    this.config = {
      intensity: 'high',
      screenShake: true,
      particles: true,
      slowMotion: true,
      colorFlash: true,
      ...config,
    };
  }

  // -------------------- CONFIGURATION --------------------

  setConfig(config: Partial<VFXConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setCallbacks(callbacks: {
    onSpawnParticles?: (preset: Partial<ParticleConfig>, position: Vector2, color?: string) => void;
    onScreenEffect?: (effect: ScreenEffect) => void;
    onFloatingText?: (position: Vector2, text: string, color: string, size: number) => void;
  }): void {
    if (callbacks.onSpawnParticles) this.onSpawnParticles = callbacks.onSpawnParticles;
    if (callbacks.onScreenEffect) this.onScreenEffect = callbacks.onScreenEffect;
    if (callbacks.onFloatingText) this.onFloatingText = callbacks.onFloatingText;
  }

  // -------------------- UPDATE --------------------

  update(dt: number): void {
    // Update active events
    for (let i = this.activeEvents.length - 1; i >= 0; i--) {
      const event = this.activeEvents[i];
      event.elapsed += dt * this.timeScale;

      if (event.elapsed >= event.duration) {
        this.activeEvents.splice(i, 1);
      }
    }

    // Update screen effects
    for (let i = this.screenEffects.length - 1; i >= 0; i--) {
      const effect = this.screenEffects[i];
      effect.elapsed += dt;

      if (effect.elapsed >= effect.duration) {
        // Reset time scale if slowmo ended
        if (effect.type === 'slowmo') {
          this.timeScale = 1;
        }
        this.screenEffects.splice(i, 1);
      }
    }
  }

  getTimeScale(): number {
    return this.timeScale;
  }

  // -------------------- TRIGGER VFX --------------------

  /**
   * Hit confirmation - when player deals damage
   */
  triggerHitConfirm(position: Vector2, damage: number, isCrit: boolean = false): void {
    if (!this.config.particles) return;

    const event: VFXEvent = {
      type: 'hit_confirm',
      position: { ...position },
      data: { damage, isCrit },
      duration: 0.3,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    // Spawn particles
    const preset = { ...PARTICLE_PRESETS.hit_sparks };
    if (isCrit) {
      preset.count = 16;
      preset.size = 5;
      preset.color = ['#fbbf24', '#f59e0b', '#ffffff'];
    }
    this.onSpawnParticles?.(preset, position);

    // Screen shake
    if (this.config.screenShake) {
      const shakeIntensity = isCrit ? 6 : 3;
      this.addScreenEffect({
        type: 'shake',
        intensity: shakeIntensity * this.getIntensityMultiplier(),
        duration: 0.1,
        elapsed: 0,
      });
    }

    // Floating damage text
    const color = isCrit ? '#fbbf24' : '#ef4444';
    const size = isCrit ? 24 : 18;
    const text = isCrit ? `${Math.floor(damage)}!` : `-${Math.floor(damage)}`;
    this.onFloatingText?.(position, text, color, size);
  }

  /**
   * Kill celebration - when player kills an enemy
   */
  triggerKillCelebration(position: Vector2, killerFaction: Faction, victimRadius: number): void {
    const event: VFXEvent = {
      type: 'kill_celebration',
      position: { ...position },
      data: { killerFaction, victimRadius },
      duration: 0.8,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    // Burst particles
    if (this.config.particles) {
      const factionColor = FACTION_CONFIG[killerFaction]?.color || '#ffffff';
      const preset = {
        ...PARTICLE_PRESETS.kill_burst,
        count: Math.min(50, 20 + Math.floor(victimRadius / 3)),
      };
      this.onSpawnParticles?.(preset, position, factionColor);

      // Soul essence rising
      this.onSpawnParticles?.(PARTICLE_PRESETS.soul_essence, position);
    }

    // Screen effects
    if (this.config.screenShake) {
      this.addScreenEffect({
        type: 'shake',
        intensity: 8 * this.getIntensityMultiplier(),
        duration: 0.2,
        elapsed: 0,
      });
    }

    // Slow motion for bigger kills
    if (this.config.slowMotion && victimRadius > 50) {
      this.timeScale = 0.3;
      this.addScreenEffect({
        type: 'slowmo',
        intensity: 0.3,
        duration: 0.3,
        elapsed: 0,
      });
    }

    // Floating text
    this.onFloatingText?.(position, '+KILL', '#22c55e', 28);
  }

  /**
   * Death burst - when entity dies
   */
  triggerDeathBurst(position: Vector2, faction: Faction, radius: number): void {
    const event: VFXEvent = {
      type: 'death_burst',
      position: { ...position },
      data: { faction, radius },
      duration: 1.2,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    if (this.config.particles) {
      const factionColor = FACTION_CONFIG[faction]?.color || '#ffffff';
      const preset = {
        ...PARTICLE_PRESETS.death_explosion,
        count: Math.min(80, 30 + Math.floor(radius / 2)),
        color: [factionColor, '#ffffff', '#000000'],
      };
      this.onSpawnParticles?.(preset, position);
    }

    if (this.config.screenShake) {
      this.addScreenEffect({
        type: 'shake',
        intensity: 15 * this.getIntensityMultiplier(),
        duration: 0.4,
        elapsed: 0,
      });
    }
  }

  /**
   * Evolution transform - when player tiers up
   */
  triggerEvolutionTransform(position: Vector2, fromTier: string, toTier: string, faction: Faction): void {
    const event: VFXEvent = {
      type: 'evolution_transform',
      position: { ...position },
      data: { fromTier, toTier, faction },
      duration: 2,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    if (this.config.particles) {
      this.onSpawnParticles?.(PARTICLE_PRESETS.evolution_aura, position);
    }

    // Zoom effect
    this.addScreenEffect({
      type: 'zoom',
      intensity: 1.15,
      duration: 0.5,
      elapsed: 0,
    });

    // Flash
    if (this.config.colorFlash) {
      const factionColor = FACTION_CONFIG[faction]?.color || '#a855f7';
      this.addScreenEffect({
        type: 'flash',
        intensity: 0.3,
        duration: 0.3,
        elapsed: 0,
        color: factionColor,
      });
    }

    this.onFloatingText?.(position, `EVOLUTION: ${toTier}`, '#a855f7', 32);
  }

  /**
   * Legendary evolution - when player gets mutation combo
   */
  triggerLegendaryEvolution(position: Vector2, evolutionName: string): void {
    const event: VFXEvent = {
      type: 'legendary_evolution',
      position: { ...position },
      data: { evolutionName },
      duration: 3,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    if (this.config.particles) {
      this.onSpawnParticles?.(PARTICLE_PRESETS.legendary_burst, position);
    }

    // All the effects!
    this.addScreenEffect({
      type: 'zoom',
      intensity: 1.3,
      duration: 1,
      elapsed: 0,
    });

    this.addScreenEffect({
      type: 'chromatic',
      intensity: 10,
      duration: 0.5,
      elapsed: 0,
    });

    if (this.config.slowMotion) {
      this.timeScale = 0.2;
      this.addScreenEffect({
        type: 'slowmo',
        intensity: 0.2,
        duration: 1,
        elapsed: 0,
      });
    }

    this.onFloatingText?.(position, `LEGENDARY: ${evolutionName}`, '#fbbf24', 40);
  }

  /**
   * Skill telegraph - show skill charge/area
   */
  triggerSkillTelegraph(position: Vector2, faction: Faction, radius: number): void {
    const event: VFXEvent = {
      type: 'skill_telegraph',
      position: { ...position },
      data: { faction, radius },
      duration: 0.5,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    if (this.config.particles) {
      const factionColor = FACTION_CONFIG[faction]?.color || '#ffffff';
      const preset = {
        ...PARTICLE_PRESETS.skill_ring,
        color: factionColor,
      };
      this.onSpawnParticles?.(preset, position, factionColor);
    }
  }

  /**
   * Skill impact - when skill hits
   */
  triggerSkillImpact(position: Vector2, faction: Faction, damage: number): void {
    const event: VFXEvent = {
      type: 'skill_impact',
      position: { ...position },
      data: { faction, damage },
      duration: 0.4,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    if (this.config.particles) {
      const factionColor = FACTION_CONFIG[faction]?.color || '#ffffff';
      this.onSpawnParticles?.(PARTICLE_PRESETS.hit_sparks, position, factionColor);
    }

    if (this.config.screenShake) {
      this.addScreenEffect({
        type: 'shake',
        intensity: 5 * this.getIntensityMultiplier(),
        duration: 0.15,
        elapsed: 0,
      });
    }
  }

  /**
   * Damage taken - player receives damage
   */
  triggerDamageTaken(position: Vector2, damage: number, source: string): void {
    const event: VFXEvent = {
      type: 'damage_taken',
      position: { ...position },
      data: { damage, source },
      duration: 0.3,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    if (this.config.colorFlash) {
      this.addScreenEffect({
        type: 'flash',
        intensity: Math.min(0.5, damage / 50),
        duration: 0.15,
        elapsed: 0,
        color: '#ef4444',
      });

      this.addScreenEffect({
        type: 'vignette',
        intensity: 0.3,
        duration: 0.3,
        elapsed: 0,
      });
    }

    if (this.config.screenShake && damage > 10) {
      this.addScreenEffect({
        type: 'shake',
        intensity: Math.min(10, damage / 5) * this.getIntensityMultiplier(),
        duration: 0.15,
        elapsed: 0,
      });
    }
  }

  /**
   * Heal received
   */
  triggerHealReceived(position: Vector2, amount: number): void {
    const event: VFXEvent = {
      type: 'heal_received',
      position: { ...position },
      data: { amount },
      duration: 0.5,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    if (this.config.colorFlash) {
      this.addScreenEffect({
        type: 'flash',
        intensity: 0.2,
        duration: 0.2,
        elapsed: 0,
        color: '#22c55e',
      });
    }

    this.onFloatingText?.(position, `+${Math.floor(amount)}`, '#22c55e', 18);
  }

  /**
   * Zone enter - entering a new elemental zone
   */
  triggerZoneEnter(position: Vector2, faction: Faction): void {
    const event: VFXEvent = {
      type: 'zone_enter',
      position: { ...position },
      data: { faction },
      duration: 1,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    if (this.config.particles) {
      const presetKey = `${faction.toLowerCase()}_embers`;
      const preset = PARTICLE_PRESETS[presetKey] || PARTICLE_PRESETS.fire_embers;
      this.onSpawnParticles?.(preset, position);
    }
  }

  /**
   * Relic pickup
   */
  triggerRelicPickup(position: Vector2): void {
    const event: VFXEvent = {
      type: 'relic_pickup',
      position: { ...position },
      data: {},
      duration: 1,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    if (this.config.particles) {
      this.onSpawnParticles?.({
        ...PARTICLE_PRESETS.legendary_burst,
        count: 50,
        color: ['#fbbf24', '#f59e0b'],
      }, position);
    }

    if (this.config.colorFlash) {
      this.addScreenEffect({
        type: 'flash',
        intensity: 0.3,
        duration: 0.3,
        elapsed: 0,
        color: '#fbbf24',
      });
    }

    this.onFloatingText?.(position, 'ANCIENT RELIC!', '#fbbf24', 28);
  }

  /**
   * Round change
   */
  triggerRoundChange(round: number): void {
    if (this.config.screenShake) {
      this.addScreenEffect({
        type: 'shake',
        intensity: 12,
        duration: 0.5,
        elapsed: 0,
      });
    }

    this.addScreenEffect({
      type: 'chromatic',
      intensity: 8,
      duration: 0.8,
      elapsed: 0,
    });

    if (this.config.colorFlash) {
      this.addScreenEffect({
        type: 'vignette',
        intensity: 0.5,
        duration: 1,
        elapsed: 0,
      });
    }
  }

  /**
   * Boss spawn
   */
  triggerBossSpawn(position: Vector2): void {
    const event: VFXEvent = {
      type: 'boss_spawn',
      position: { ...position },
      data: {},
      duration: 2,
      elapsed: 0,
    };
    this.activeEvents.push(event);

    if (this.config.particles) {
      this.onSpawnParticles?.(PARTICLE_PRESETS.legendary_burst, position);
    }

    if (this.config.slowMotion) {
      this.timeScale = 0.5;
      this.addScreenEffect({
        type: 'slowmo',
        intensity: 0.5,
        duration: 1,
        elapsed: 0,
      });
    }

    this.addScreenEffect({
      type: 'chromatic',
      intensity: 10,
      duration: 1,
      elapsed: 0,
    });
  }

  // -------------------- ZONE AMBIENT PARTICLES --------------------

  /**
   * Spawn ambient particles for zones
   */
  spawnZoneAmbientParticles(position: Vector2, faction: Faction): void {
    if (!this.config.particles) return;
    if (this.config.intensity === 'low') return;

    // Random chance based on intensity
    const chance = this.config.intensity === 'ultra' ? 0.05 : this.config.intensity === 'high' ? 0.03 : 0.01;
    if (Math.random() > chance) return;

    let preset: Partial<ParticleConfig>;

    switch (faction) {
      case 'Hoa' as Faction:
        preset = PARTICLE_PRESETS.fire_embers;
        break;
      case 'Thuy' as Faction:
        preset = PARTICLE_PRESETS.water_bubbles;
        break;
      case 'Kim' as Faction:
        preset = PARTICLE_PRESETS.metal_sparks;
        break;
      case 'Moc' as Faction:
        preset = PARTICLE_PRESETS.wood_leaves;
        break;
      case 'Tho' as Faction:
        preset = PARTICLE_PRESETS.earth_dust;
        break;
      default:
        return;
    }

    // Randomize position slightly
    const randomOffset = {
      x: position.x + (Math.random() - 0.5) * 100,
      y: position.y + (Math.random() - 0.5) * 100,
    };

    this.onSpawnParticles?.({ ...preset, count: 1 }, randomOffset);
  }

  // -------------------- HELPERS --------------------

  private addScreenEffect(effect: ScreenEffect): void {
    this.screenEffects.push(effect);
    this.onScreenEffect?.(effect);
  }

  private getIntensityMultiplier(): number {
    switch (this.config.intensity) {
      case 'low':
        return 0.5;
      case 'medium':
        return 0.75;
      case 'high':
        return 1;
      case 'ultra':
        return 1.5;
      default:
        return 1;
    }
  }

  // -------------------- GETTERS --------------------

  getActiveEvents(): VFXEvent[] {
    return this.activeEvents;
  }

  getScreenEffects(): ScreenEffect[] {
    return this.screenEffects;
  }

  getShakeIntensity(): number {
    let total = 0;
    for (const effect of this.screenEffects) {
      if (effect.type === 'shake') {
        const progress = 1 - effect.elapsed / effect.duration;
        total += effect.intensity * progress;
      }
    }
    return total;
  }

  getFlashColor(): string | null {
    for (const effect of this.screenEffects) {
      if (effect.type === 'flash' && effect.color) {
        const progress = 1 - effect.elapsed / effect.duration;
        if (progress > 0) return effect.color;
      }
    }
    return null;
  }

  getFlashIntensity(): number {
    let max = 0;
    for (const effect of this.screenEffects) {
      if (effect.type === 'flash') {
        const progress = 1 - effect.elapsed / effect.duration;
        max = Math.max(max, effect.intensity * progress);
      }
    }
    return max;
  }

  getVignetteIntensity(): number {
    let max = 0;
    for (const effect of this.screenEffects) {
      if (effect.type === 'vignette') {
        const progress = 1 - effect.elapsed / effect.duration;
        max = Math.max(max, effect.intensity * progress);
      }
    }
    return max;
  }

  getZoomLevel(): number {
    let zoom = 1;
    for (const effect of this.screenEffects) {
      if (effect.type === 'zoom') {
        const progress = 1 - effect.elapsed / effect.duration;
        // Ease out
        const eased = 1 - Math.pow(1 - progress, 3);
        zoom = Math.max(zoom, 1 + (effect.intensity - 1) * eased);
      }
    }
    return zoom;
  }

  getChromaticAberration(): number {
    let max = 0;
    for (const effect of this.screenEffects) {
      if (effect.type === 'chromatic') {
        const progress = 1 - effect.elapsed / effect.duration;
        max = Math.max(max, effect.intensity * progress);
      }
    }
    return max;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const vfxManager = new VFXManager();
