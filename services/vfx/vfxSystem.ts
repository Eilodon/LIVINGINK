/**
 * VFX SYSTEM - Game Juice Excellence
 * 
 * Creating visual feedback that makes every action feel impactful and satisfying
 * Focus on Ring Commit VFX as the centerpiece of player progression
 */

import { GameState, Player, Vector2 } from '../../types';
import { RingId } from '../cjr/cjrTypes';
import { createParticle } from '../engine/factories';

// ============================================
// VFX CONFIGURATION - Premium Quality
// ============================================

interface VFXConfig {
  particleCount: number;
  duration: number;
  intensity: number;
  color: string;
  spread: number;
  speed: number;
  fadeOut: boolean;
  scale: number;
}

interface RingCommitVFX extends VFXConfig {
  ringId: RingId;
  membraneColor: string;
  pulseColor: string;
  shockwaveColor: string;
  screenShake: {
    intensity: number;
    duration: number;
    frequency: number;
  };
  soundEffect: {
    id: string;
    volume: number;
    pitch: number;
  };
}

// Premium VFX configurations for each ring
const RING_COMMIT_VFX_CONFIGS: Record<RingId, RingCommitVFX> = {
  1: {
    ringId: 1,
    particleCount: 30,
    duration: 2.0,
    intensity: 0.7,
    color: '#4CAF50',
    spread: Math.PI * 0.8,
    speed: 150,
    fadeOut: true,
    scale: 1.0,
    membraneColor: 'rgba(76, 175, 80, 0.3)',
    pulseColor: '#81C784',
    shockwaveColor: 'rgba(76, 175, 80, 0.6)',
    screenShake: {
      intensity: 0.3,
      duration: 0.5,
      frequency: 15
    },
    soundEffect: {
      id: 'ring_commit_1',
      volume: 0.6,
      pitch: 1.0
    }
  },
  2: {
    ringId: 2,
    particleCount: 50,
    duration: 2.5,
    intensity: 0.85,
    color: '#2196F3',
    spread: Math.PI * 1.0,
    speed: 200,
    fadeOut: true,
    scale: 1.2,
    membraneColor: 'rgba(33, 150, 243, 0.4)',
    pulseColor: '#64B5F6',
    shockwaveColor: 'rgba(33, 150, 243, 0.7)',
    screenShake: {
      intensity: 0.5,
      duration: 0.7,
      frequency: 20
    },
    soundEffect: {
      id: 'ring_commit_2',
      volume: 0.7,
      pitch: 0.9
    }
  },
  3: {
    ringId: 3,
    particleCount: 80,
    duration: 3.0,
    intensity: 1.0,
    color: '#FF9800',
    spread: Math.PI * 1.2,
    speed: 250,
    fadeOut: true,
    scale: 1.5,
    membraneColor: 'rgba(255, 152, 0, 0.5)',
    pulseColor: '#FFB74D',
    shockwaveColor: 'rgba(255, 152, 0, 0.8)',
    screenShake: {
      intensity: 0.7,
      duration: 1.0,
      frequency: 25
    },
    soundEffect: {
      id: 'ring_commit_3',
      volume: 0.8,
      pitch: 0.8
    }
  }
};

// ============================================
// PREMIUM VFX IMPLEMENTATION
// ============================================

export class VFXSystem {
  private activeEffects: Map<string, VFXEffect> = new Map();
  private screenShake: ScreenShakeController;
  private audioController: AudioController;

  constructor() {
    this.screenShake = new ScreenShakeController();
    this.audioController = new AudioController();
  }

  /**
   * Play Ring Commit VFX - The most important visual feedback in the game
   */
  playRingCommitVFX(player: Player, ringId: RingId, state: GameState): void {
    const config = RING_COMMIT_VFX_CONFIGS[ringId];
    const effectId = `ring_commit_${player.id}_${Date.now()}`;

    // 1. Create membrane ripple effect
    this.createMembraneRipple(player.position, config, state);

    // 2. Create particle burst
    this.createParticleBurst(player.position, config, state);

    // 3. Create pulse effect
    this.createPulseEffect(player.position, config, state);

    // 4. Create shockwave
    this.createShockwave(player.position, config, state);

    // 5. Apply screen shake
    this.screenShake.applyShake(config.screenShake);

    // 6. Play sound effect
    this.audioController.playSound(config.soundEffect);

    // 7. Create floating text
    this.createFloatingText(player.position, `RING ${ringId} COMMITTED!`, config.color, state);

    // 8. Track effect for cleanup
    const effect: VFXEffect = {
      id: effectId,
      type: 'ring_commit',
      position: player.position,
      config,
      startTime: Date.now(),
      duration: config.duration * 1000
    };
    this.activeEffects.set(effectId, effect);
  }

  /**
   * Create membrane ripple effect - The visual barrier being crossed
   */
  private createMembraneRipple(position: Vector2, config: RingCommitVFX, state: GameState): void {
    // Create expanding rings that represent the membrane
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const ripple = createParticle(
          position.x,
          position.y,
          config.membraneColor,
          0
        );
        
        // Custom ripple behavior
        ripple.radius = 10;
        ripple.maxLife = config.duration;
        ripple.life = config.duration;
        ripple.rippleRadius = 0;
        ripple.rippleMaxRadius = 200 * (i + 1);
        ripple.rippleSpeed = 300;
        ripple.rippleColor = config.membraneColor;
        ripple.isRipple = true;
        
        state.particles.push(ripple);
      }, i * 100);
    }
  }

  /**
   * Create particle burst - Celebration of achievement
   */
  private createParticleBurst(position: Vector2, config: RingCommitVFX, state: GameState): void {
    for (let i = 0; i < config.particleCount; i++) {
      const angle = (i / config.particleCount) * config.spread;
      const speed = config.speed * (0.5 + Math.random() * 0.5);
      
      const particle = createParticle(
        position.x,
        position.y,
        config.color,
        speed
      );
      
      // Set particle velocity in burst pattern
      particle.velocity.x = Math.cos(angle) * speed;
      particle.velocity.y = Math.sin(angle) * speed;
      particle.life = config.duration;
      particle.maxLife = config.duration;
      particle.scale = config.scale;
      particle.fadeOut = config.fadeOut;
      
      state.particles.push(particle);
    }
  }

  /**
   * Create pulse effect - Heartbeat of the ring
   */
  private createPulseEffect(position: Vector2, config: RingCommitVFX, state: GameState): void {
    // Create central pulse that expands outward
    const pulse = createParticle(position.x, position.y, config.pulseColor, 0);
    
    pulse.radius = 5;
    pulse.maxLife = config.duration * 0.5;
    pulse.life = pulse.maxLife;
    pulse.pulseRadius = 0;
    pulse.pulseMaxRadius = 150;
    pulse.pulseSpeed = 200;
    pulse.pulseColor = config.pulseColor;
    pulse.isPulse = true;
    pulse.glowIntensity = config.intensity;
    
    state.particles.push(pulse);
  }

  /**
   * Create shockwave - Power of the commitment
   */
  private createShockwave(position: Vector2, config: RingCommitVFX, state: GameState): void {
    // Create shockwave ring
    const shockwave = createParticle(position.x, position.y, config.shockwaveColor, 0);
    
    shockwave.radius = 1;
    shockwave.maxLife = config.duration * 0.7;
    shockwave.life = shockwave.maxLife;
    shockwave.shockwaveRadius = 0;
    shockwave.shockwaveMaxRadius = 300;
    shockwave.shockwaveSpeed = 400;
    shockwave.shockwaveColor = config.shockwaveColor;
    shockwave.isShockwave = true;
    shockwave.intensity = config.intensity;
    
    state.particles.push(shockwave);
  }

  /**
   * Create floating text - Visual confirmation
   */
  private createFloatingText(position: Vector2, text: string, color: string, state: GameState): void {
    // This would integrate with the existing floating text system
    // For now, create a simple particle that represents text
    const textParticle = createParticle(position.x, position.y - 50, color, 0);
    textParticle.radius = 20;
    textParticle.maxLife = 2.0;
    textParticle.life = textParticle.maxLife;
    textParticle.isText = true;
    textParticle.textContent = text;
    textParticle.textColor = color;
    textParticle.fontSize = 24;
    textParticle.fadeOut = true;
    
    state.particles.push(textParticle);
  }

  /**
   * Update all active VFX effects
   */
  updateEffects(state: GameState, dt: number): void {
    const now = Date.now();
    
    // Clean up expired effects
    for (const [id, effect] of this.activeEffects.entries()) {
      if (now - effect.startTime > effect.duration) {
        this.activeEffects.delete(id);
      }
    }

    // Update screen shake
    this.screenShake.update(dt);
  }

  /**
   * Get current screen shake offset
   */
  getScreenShakeOffset(): Vector2 {
    return this.screenShake.getCurrentOffset();
  }
}

// ============================================
// SPECIALIZED CONTROLLERS
// ============================================

class ScreenShakeController {
  private intensity: number = 0;
  private duration: number = 0;
  private frequency: number = 0;
  private currentTime: number = 0;
  private currentOffset: Vector2 = { x: 0, y: 0 };

  applyShake(config: { intensity: number; duration: number; frequency: number }): void {
    this.intensity = config.intensity;
    this.duration = config.duration;
    this.frequency = config.frequency;
    this.currentTime = 0;
  }

  update(dt: number): void {
    if (this.currentTime >= this.duration) {
      this.currentOffset = { x: 0, y: 0 };
      return;
    }

    this.currentTime += dt;
    const progress = this.currentTime / this.duration;
    const fadeOut = 1 - progress;

    // Generate shake offset
    const shakeX = Math.sin(this.currentTime * this.frequency) * this.intensity * fadeOut;
    const shakeY = Math.cos(this.currentTime * this.frequency * 1.3) * this.intensity * fadeOut;

    this.currentOffset = { x: shakeX, y: shakeY };
  }

  getCurrentOffset(): Vector2 {
    return this.currentOffset;
  }
}

class AudioController {
  private audioContext: AudioContext | null = null;
  private soundCache: Map<string, AudioBuffer> = new Map();

  constructor() {
    // Initialize audio context on user interaction
    this.initAudioContext();
  }

  private initAudioContext(): void {
    if (typeof window !== 'undefined' && !this.audioContext) {
      // Check if we're in test environment
      if (typeof global !== 'undefined' && (global as any).vitest) {
        // In test environment, create a mock AudioContext
        this.audioContext = {
          createGainNode: () => ({} as GainNode),
          createOscillator: () => ({} as OscillatorNode),
          createAnalyser: () => ({} as AnalyserNode),
          createBiquadFilter: () => ({} as BiquadFilterNode),
          createChannelMerger: () => ({} as ChannelMergerNode),
          createDelayNode: () => ({} as DelayNode),
          createConvolver: () => ({} as ConvolverNode),
          createScriptProcessorNode: () => ({} as ScriptProcessorNode),
          createWaveShaper: () => ({} as WaveShaperNode),
          createPanner: () => ({} as PannerNode),
          createPeriodicWave: () => ({} as PeriodicWave),
          createStereoPanner: () => ({} as StereoPannerNode),
          createDynamicsCompressor: () => ({} as DynamicsCompressorNode),
          close: () => Promise.resolve(),
          resume: () => Promise.resolve(),
          suspend: () => Promise.resolve(),
          createMediaStream: () => ({} as MediaStream),
          currentTime: 0,
          outputTimestamp: 0,
          sampleRate: 48000,
          state: 'suspended',
          destination: null
        } as any;
      } else {
        // In production environment, create real AudioContext
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    }
  }

  playSound(config: { id: string; volume: number; pitch: number }): void {
    if (!this.audioContext) return;

    // For now, create a simple tone
    // In production, this would load actual sound files
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = 440 * config.pitch;
    gainNode.gain.value = config.volume;

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }
}

// ============================================
// TYPE DEFINITIONS
// ============================================

interface VFXEffect {
  id: string;
  type: string;
  position: Vector2;
  config: VFXConfig;
  startTime: number;
  duration: number;
}

// Extended particle interface for VFX
declare module '../../types' {
  interface Particle {
    intensity?: number;
    
    rippleRadius?: number;
    rippleMaxRadius?: number;
    rippleSpeed?: number;
    rippleColor?: string;
    isRipple?: boolean;
    
    pulseRadius?: number;
    pulseMaxRadius?: number;
    pulseSpeed?: number;
    pulseColor?: string;
    isPulse?: boolean;
    glowIntensity?: number;
    
    shockwaveRadius?: number;
    shockwaveMaxRadius?: number;
    shockwaveSpeed?: number;
    shockwaveColor?: string;
    isShockwave?: boolean;
    
    isText?: boolean;
    textContent?: string;
    textColor?: string;
    fontSize?: number;
    
    scale?: number;
    fadeOut?: boolean;
  }
}

// ============================================
// GLOBAL VFX INSTANCE
// ============================================

export const vfxSystem = new VFXSystem();
