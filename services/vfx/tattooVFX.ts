/**
 * TATTOO VFX SYSTEM - Premium Visual Effects
 * 
 * Creating unique, memorable visual effects for each tattoo activation
 * Each tattoo deserves its own signature visual identity
 */

import { GameState, Player, Vector2 } from '../../types';
import { TattooId } from '../cjr/cjrTypes';
import { createParticle } from '../engine/factories';

// ============================================
// TATTOO VFX CONFIGURATIONS - Unique Identity
// ============================================

interface TattooVFXConfig {
  id: TattooId;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  particleCount: number;
  duration: number;
  pattern: 'burst' | 'spiral' | 'wave' | 'geometric' | 'organic';
  specialEffects: string[];
  soundProfile: {
    pitch: number;
    volume: number;
    character: 'magical' | 'tech' | 'nature' | 'cosmic' | 'shadow' | 'organic';
  };
  iconSymbol: string; // Unicode symbol for visual representation
}

const TATTOO_VFX_CONFIGS: Record<TattooId, TattooVFXConfig> = {
  [TattooId.FilterInk]: {
    id: TattooId.FilterInk,
    name: 'Filter Ink',
    primaryColor: '#9C27B0',
    secondaryColor: '#E1BEE7',
    particleCount: 40,
    duration: 2.0,
    pattern: 'wave',
    specialEffects: ['shield_bubble', 'color_filter', 'purification'],
    soundProfile: {
      pitch: 0.9,
      volume: 0.6,
      character: 'magical' as const
    },
    iconSymbol: '🛡️'
  },
  [TattooId.Overdrive]: {
    id: TattooId.Overdrive,
    name: 'Overdrive',
    primaryColor: '#FF5722',
    secondaryColor: '#FFCCBC',
    particleCount: 60,
    duration: 3.0,
    pattern: 'spiral',
    specialEffects: ['speed_trails', 'energy_aura', 'motion_blur'],
    soundProfile: {
      pitch: 1.2,
      volume: 0.8,
      character: 'tech' as const
    },
    iconSymbol: '⚡'
  },
  [TattooId.DepositShield]: {
    id: TattooId.DepositShield,
    name: 'Deposit Shield',
    primaryColor: '#2196F3',
    secondaryColor: '#BBDEFB',
    particleCount: 50,
    duration: 2.5,
    pattern: 'geometric',
    specialEffects: ['hexagon_shield', 'energy_barrier', 'protective_aura'],
    soundProfile: {
      pitch: 0.8,
      volume: 0.7,
      character: 'cosmic' as const
    },
    iconSymbol: '🔷'
  },
  [TattooId.PigmentBomb]: {
    id: TattooId.PigmentBomb,
    name: 'Pigment Bomb',
    primaryColor: '#E91E63',
    secondaryColor: '#F8BBD0',
    particleCount: 80,
    duration: 2.0,
    pattern: 'burst',
    specialEffects: ['color_explosion', 'splash_damage', 'ink_spray'],
    soundProfile: {
      pitch: 1.0,
      volume: 0.9,
      character: 'organic' as const
    },
    iconSymbol: '💥'
  },
  [TattooId.PerfectMatch]: {
    id: TattooId.PerfectMatch,
    name: 'Perfect Match',
    primaryColor: '#FFD700',
    secondaryColor: '#FFF59D',
    particleCount: 100,
    duration: 3.5,
    pattern: 'geometric',
    specialEffects: ['golden_aura', 'star_burst', 'perfection_glow'],
    soundProfile: {
      pitch: 1.4,
      volume: 0.8,
      character: 'cosmic' as const
    },
    iconSymbol: '⭐'
  },
  [TattooId.CatalystSense]: {
    id: TattooId.CatalystSense,
    name: 'Catalyst Sense',
    primaryColor: '#9C27B0',
    secondaryColor: '#E1BEE7',
    particleCount: 45,
    duration: 2.8,
    pattern: 'spiral',
    specialEffects: ['magnetic_field', 'energy_lines', 'attraction_aura'],
    soundProfile: {
      pitch: 1.1,
      volume: 0.6,
      character: 'magical' as const
    },
    iconSymbol: '🌀'
  },
  [TattooId.NeutralMastery]: {
    id: TattooId.NeutralMastery,
    name: 'Neutral Mastery',
    primaryColor: '#607D8B',
    secondaryColor: '#CFD8DC',
    particleCount: 35,
    duration: 2.2,
    pattern: 'organic',
    specialEffects: ['balance_effect', 'harmony_aura', 'equilibrium'],
    soundProfile: {
      pitch: 0.85,
      volume: 0.5,
      character: 'nature' as const
    },
    iconSymbol: '⚖️'
  },
  [TattooId.SolventExpert]: {
    id: TattooId.SolventExpert,
    name: 'Solvent Expert',
    primaryColor: '#00BCD4',
    secondaryColor: '#B2EBF2',
    particleCount: 55,
    duration: 2.6,
    pattern: 'wave',
    specialEffects: ['cleansing_wave', 'purification_field', 'refresh_aura'],
    soundProfile: {
      pitch: 1.0,
      volume: 0.7,
      character: 'nature' as const
    },
    iconSymbol: '💧'
  }
};

// ============================================
// TATTOO VFX IMPLEMENTATION
// ============================================

export class TattooVFXSystem {
  private activeEffects: Map<string, TattooVFXEffect> = new Map();

  /**
   * Play tattoo activation VFX - Make each tattoo feel unique and powerful
   */
  playTattooActivationVFX(player: Player, tattooId: TattooId, state: GameState): void {
    const config = TATTOO_VFX_CONFIGS[tattooId];
    if (!config) return;

    const effectId = `tattoo_${tattooId}_${player.id}_${Date.now()}`;

    // Create tattoo icon floating above player
    this.createTattooIcon(player.position, config, state);

    // Create pattern-specific effects
    switch (config.pattern) {
      case 'burst':
        this.createBurstPattern(player.position, config, state);
        break;
      case 'spiral':
        this.createSpiralPattern(player.position, config, state);
        break;
      case 'wave':
        this.createWavePattern(player.position, config, state);
        break;
      case 'geometric':
        this.createGeometricPattern(player.position, config, state);
        break;
      case 'organic':
        this.createOrganicPattern(player.position, config, state);
        break;
    }

    // Apply special effects
    config.specialEffects.forEach(effect => {
      this.applySpecialEffect(effect, player, config, state);
    });

    // Create activation aura around player
    this.createActivationAura(player, config, state);

    // Track effect
    const effect: TattooVFXEffect = {
      id: effectId,
      tattooId,
      playerId: player.id,
      position: player.position,
      config,
      startTime: Date.now(),
      duration: config.duration * 1000
    };
    this.activeEffects.set(effectId, effect);
  }

  /**
   * Create floating tattoo icon
   */
  private createTattooIcon(position: Vector2, config: TattooVFXConfig, state: GameState): void {
    const icon = createParticle(
      position.x,
      position.y - 60,
      config.primaryColor,
      0
    );

    icon.radius = 30;
    icon.maxLife = config.duration;
    icon.life = icon.maxLife;
    icon.isIcon = true;
    icon.iconSymbol = config.iconSymbol;
    icon.iconColor = config.primaryColor;
    icon.fontSize = 32;
    icon.floatUpward = true;
    icon.floatSpeed = 30;
    icon.fadeOut = true;

    state.particles.push(icon);
  }

  /**
   * Burst pattern - Explosive energy release
   */
  private createBurstPattern(position: Vector2, config: TattooVFXConfig, state: GameState): void {
    for (let i = 0; i < config.particleCount; i++) {
      const angle = (i / config.particleCount) * Math.PI * 2;
      const speed = 150 + Math.random() * 100;
      
      const particle = createParticle(position.x, position.y, config.primaryColor, speed);
      
      particle.velocity.x = Math.cos(angle) * speed;
      particle.velocity.y = Math.sin(angle) * speed;
      particle.life = config.duration;
      particle.maxLife = config.duration;
      particle.fadeOut = true;
      particle.glowIntensity = 0.8;
      
      state.particles.push(particle);
    }
  }

  /**
   * Spiral pattern - Hypnotic energy flow
   */
  private createSpiralPattern(position: Vector2, config: TattooVFXConfig, state: GameState): void {
    const spiralCount = 3;
    
    for (let spiral = 0; spiral < spiralCount; spiral++) {
      setTimeout(() => {
        for (let i = 0; i < config.particleCount / spiralCount; i++) {
          const angle = (i / (config.particleCount / spiralCount)) * Math.PI * 4;
          const radius = 20 + i * 3;
          
          const x = position.x + Math.cos(angle) * radius;
          const y = position.y + Math.sin(angle) * radius;
          
          const particle = createParticle(x, y, config.secondaryColor, 100);
          
          // Spiral inward motion
          particle.velocity.x = -Math.cos(angle) * 50;
          particle.velocity.y = -Math.sin(angle) * 50;
          particle.life = config.duration;
          particle.maxLife = config.duration;
          particle.fadeOut = true;
          particle.glowIntensity = 0.6;
          
          state.particles.push(particle);
        }
      }, spiral * 200);
    }
  }

  /**
   * Wave pattern - Flowing energy waves
   */
  private createWavePattern(position: Vector2, config: TattooVFXConfig, state: GameState): void {
    const waveCount = 5;
    
    for (let wave = 0; wave < waveCount; wave++) {
      setTimeout(() => {
        for (let i = 0; i < config.particleCount / waveCount; i++) {
          const angle = (i / (config.particleCount / waveCount)) * Math.PI * 2;
          const radius = 30 + wave * 20;
          
          const x = position.x + Math.cos(angle) * radius;
          const y = position.y + Math.sin(angle) * radius;
          
          const particle = createParticle(x, y, config.primaryColor, 80);
          
          // Wave motion
          particle.velocity.x = Math.cos(angle + Math.PI/2) * 60;
          particle.velocity.y = Math.sin(angle + Math.PI/2) * 60;
          particle.life = config.duration;
          particle.maxLife = config.duration;
          particle.fadeOut = true;
          particle.waveAmplitude = 20;
          particle.waveFrequency = 3;
          
          state.particles.push(particle);
        }
      }, wave * 150);
    }
  }

  /**
   * Geometric pattern - Precise, structured energy
   */
  private createGeometricPattern(position: Vector2, config: TattooVFXConfig, state: GameState): void {
    const sides = 6; // Hexagon for Deposit Shield
    const layers = 3;
    
    for (let layer = 0; layer < layers; layer++) {
      const radius = 40 + layer * 30;
      
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const x = position.x + Math.cos(angle) * radius;
        const y = position.y + Math.sin(angle) * radius;
        
        const particle = createParticle(x, y, config.primaryColor, 0);
        
        particle.radius = 8;
        particle.maxLife = config.duration;
        particle.life = particle.maxLife;
        particle.isGeometric = true;
        particle.geometricSides = sides;
        particle.geometricRadius = radius;
        particle.rotationSpeed = 0.5;
        particle.fadeOut = true;
        
        state.particles.push(particle);
      }
    }
  }

  /**
   * Organic pattern - Natural, flowing energy
   */
  private createOrganicPattern(position: Vector2, config: TattooVFXConfig, state: GameState): void {
    for (let i = 0; i < config.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 80;
      
      const x = position.x + Math.cos(angle) * radius;
      const y = position.y + Math.sin(angle) * radius;
      
      const particle = createParticle(x, y, config.primaryColor, 50);
      
      // Organic, flowing motion
      particle.velocity.x = (Math.random() - 0.5) * 100;
      particle.velocity.y = (Math.random() - 0.5) * 100;
      particle.life = config.duration;
      particle.maxLife = config.duration;
      particle.fadeOut = true;
      particle.organicFlow = true;
      particle.flowSpeed = 0.5;
      
      state.particles.push(particle);
    }
  }

  /**
   * Apply special effects for each tattoo
   */
  private applySpecialEffect(effect: string, player: Player, config: TattooVFXConfig, state: GameState): void {
    switch (effect) {
      case 'shield_bubble':
        this.createShieldBubble(player, config, state);
        break;
      case 'speed_trails':
        this.createSpeedTrails(player, config, state);
        break;
      case 'hexagon_shield':
        this.createHexagonShield(player, config, state);
        break;
      case 'color_explosion':
        this.createColorExplosion(player, config, state);
        break;
      case 'golden_aura':
        this.createGoldenAura(player, config, state);
        break;
      case 'magnetic_field':
        this.createMagneticField(player, config, state);
        break;
      case 'balance_effect':
        this.createBalanceEffect(player, config, state);
        break;
      case 'cleansing_wave':
        this.createCleansingWave(player, config, state);
        break;
    }
  }

  /**
   * Create activation aura around player
   */
  private createActivationAura(player: Player, config: TattooVFXConfig, state: GameState): void {
    const aura = createParticle(player.position.x, player.position.y, config.primaryColor, 0);
    
    aura.radius = player.radius + 20;
    aura.maxLife = config.duration;
    aura.life = aura.maxLife;
    aura.isAura = true;
    aura.auraColor = config.primaryColor;
    aura.auraIntensity = 0.6;
    aura.pulseSpeed = 2;
    aura.fadeOut = true;
    
    state.particles.push(aura);
  }

  // Special effect implementations
  private createShieldBubble(player: Player, config: TattooVFXConfig, state: GameState): void {
    const bubble = createParticle(player.position.x, player.position.y, config.secondaryColor, 0);
    bubble.radius = player.radius + 15;
    bubble.maxLife = 2.0;
    bubble.life = bubble.maxLife;
    bubble.isBubble = true;
    bubble.bubbleColor = config.secondaryColor;
    bubble.bubbleOpacity = 0.4;
    bubble.fadeOut = true;
    state.particles.push(bubble);
  }

  private createSpeedTrails(player: Player, config: TattooVFXConfig, state: GameState): void {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const trail = createParticle(
          player.position.x - player.velocity.x * i * 0.1,
          player.position.y - player.velocity.y * i * 0.1,
          config.primaryColor,
          0
        );
        trail.radius = player.radius * (1 - i * 0.15);
        trail.maxLife = 0.5;
        trail.life = trail.maxLife;
        trail.isTrail = true;
        trail.trailColor = config.primaryColor;
        trail.fadeOut = true;
        state.particles.push(trail);
      }, i * 50);
    }
  }

  private createHexagonShield(player: Player, config: TattooVFXConfig, state: GameState): void {
    const shield = createParticle(player.position.x, player.position.y, config.primaryColor, 0);
    shield.radius = player.radius + 25;
    shield.maxLife = 2.5;
    shield.life = shield.maxLife;
    shield.isHexagonShield = true;
    shield.shieldColor = config.primaryColor;
    shield.shieldOpacity = 0.3;
    shield.rotationSpeed = 0.3;
    shield.fadeOut = true;
    state.particles.push(shield);
  }

  private createColorExplosion(player: Player, config: TattooVFXConfig, state: GameState): void {
    // Create colorful explosion
    const colors = [config.primaryColor, config.secondaryColor, '#FF6B6B', '#4ECDC4', '#45B7D1'];
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const speed = 200 + Math.random() * 100;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = createParticle(player.position.x, player.position.y, color, speed);
      particle.velocity.x = Math.cos(angle) * speed;
      particle.velocity.y = Math.sin(angle) * speed;
      particle.life = 1.5;
      particle.maxLife = 1.5;
      particle.fadeOut = true;
      particle.glowIntensity = 1.0;
      state.particles.push(particle);
    }
  }

  private createGoldenAura(player: Player, config: TattooVFXConfig, state: GameState): void {
    const aura = createParticle(player.position.x, player.position.y, config.primaryColor, 0);
    aura.radius = player.radius + 30;
    aura.maxLife = 3.0;
    aura.life = aura.maxLife;
    aura.isGoldenAura = true;
    aura.auraColor = config.primaryColor;
    aura.auraIntensity = 0.8;
    aura.sparkleIntensity = 1.0;
    aura.pulseSpeed = 1.5;
    aura.fadeOut = true;
    state.particles.push(aura);
  }

  private createMagneticField(player: Player, config: TattooVFXConfig, state: GameState): void {
    const field = createParticle(player.position.x, player.position.y, config.primaryColor, 0);
    field.radius = 150;
    field.maxLife = 2.8;
    field.life = field.maxLife;
    field.isMagneticField = true;
    field.fieldColor = config.primaryColor;
    field.fieldLines = 8;
    field.rotationSpeed = 0.5;
    field.fadeOut = true;
    state.particles.push(field);
  }

  private createBalanceEffect(player: Player, config: TattooVFXConfig, state: GameState): void {
    // Create yin-yang like effect
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const color = i === 0 ? config.primaryColor : config.secondaryColor;
      
      const particle = createParticle(
        player.position.x + side * 20,
        player.position.y,
        color,
        0
      );
      particle.radius = 15;
      particle.maxLife = 2.2;
      particle.life = particle.maxLife;
      particle.isBalanceOrb = true;
      particle.orbColor = color;
      particle.orbitRadius = 30;
      particle.orbitSpeed = side * 1;
      particle.fadeOut = true;
      state.particles.push(particle);
    }
  }

  private createCleansingWave(player: Player, config: TattooVFXConfig, state: GameState): void {
    for (let wave = 0; wave < 3; wave++) {
      setTimeout(() => {
        const waveParticle = createParticle(player.position.x, player.position.y, config.primaryColor, 0);
        waveParticle.radius = 20 + wave * 25;
        waveParticle.maxLife = 2.6;
        waveParticle.life = waveParticle.maxLife;
        waveParticle.isCleansingWave = true;
        waveParticle.waveColor = config.primaryColor;
        waveParticle.waveOpacity = 0.3 - wave * 0.1;
        waveParticle.expandSpeed = 100;
        waveParticle.fadeOut = true;
        state.particles.push(waveParticle);
      }, wave * 200);
    }
  }

  /**
   * Update all active tattoo effects
   */
  updateEffects(state: GameState, dt: number): void {
    const now = Date.now();
    
    // Clean up expired effects
    for (const [id, effect] of this.activeEffects.entries()) {
      if (now - effect.startTime > effect.duration) {
        this.activeEffects.delete(id);
      }
    }
  }
}

// ============================================
// TYPE DEFINITIONS
// ============================================

interface TattooVFXEffect {
  id: string;
  tattooId: TattooId;
  playerId: string;
  position: Vector2;
  config: TattooVFXConfig;
  startTime: number;
  duration: number;
}

// Extended particle interface for tattoo VFX
declare module '../../types' {
  interface Particle {
    // Icon effects
    isIcon?: boolean;
    iconSymbol?: string;
    iconColor?: string;
    fontSize?: number;
    floatUpward?: boolean;
    floatSpeed?: number;
    
    // Pattern effects
    waveAmplitude?: number;
    waveFrequency?: number;
    organicFlow?: boolean;
    flowSpeed?: number;
    isGeometric?: boolean;
    geometricSides?: number;
    geometricRadius?: number;
    rotationSpeed?: number;
    
    // Special effects
    isBubble?: boolean;
    bubbleColor?: string;
    bubbleOpacity?: number;
    isTrail?: boolean;
    trailColor?: string;
    isHexagonShield?: boolean;
    shieldColor?: string;
    shieldOpacity?: number;
    isGoldenAura?: boolean;
    sparkleIntensity?: number;
    isMagneticField?: boolean;
    fieldColor?: string;
    fieldLines?: number;
    isBalanceOrb?: boolean;
    orbColor?: string;
    orbitRadius?: number;
    orbitSpeed?: number;
    isCleansingWave?: boolean;
    waveColor?: string;
    waveOpacity?: number;
    expandSpeed?: number;
    
    // Aura effects
    isAura?: boolean;
    auraColor?: string;
    auraIntensity?: number;
    pulseSpeed?: number;
  }
}

// ============================================
// GLOBAL TATTOO VFX INSTANCE
// ============================================

export const tattooVFXSystem = new TattooVFXSystem();
