/**
 * VISUAL EFFECTS LIBRARY
 * Explosion, impact, skill effects with GPU acceleration
 */

export interface EffectConfig {
  name: string;
  duration: number;
  intensity: number;
  color: { r: number; g: number; b: number };
  particleCount: number;
  soundEffect?: string;
  screenShake?: number;
  lightIntensity?: number;
}

export interface EffectKeyframe {
  time: number;
  scale: number;
  opacity: number;
  color: { r: number; g: number; b: number };
  emission: number;
}

export class VisualEffectsLibrary {
  private effects: Map<string, EffectConfig> = new Map();
  private keyframes: Map<string, EffectKeyframe[]> = new Map();
  private activeEffects: Map<string, ActiveEffect> = new Map();

  constructor() {
    this.initializeEffects();
    this.initializeKeyframes();
  }

  private initializeEffects() {
    // Explosion effects
    this.effects.set('explosion_small', {
      name: 'Small Explosion',
      duration: 1.5,
      intensity: 0.6,
      color: { r: 1.0, g: 0.8, b: 0.4 },
      particleCount: 50,
      soundEffect: 'explosion_small',
      screenShake: 0.3,
      lightIntensity: 2.0,
    });

    this.effects.set('explosion_medium', {
      name: 'Medium Explosion',
      duration: 2.0,
      intensity: 0.8,
      color: { r: 1.0, g: 0.6, b: 0.2 },
      particleCount: 150,
      soundEffect: 'explosion_medium',
      screenShake: 0.5,
      lightIntensity: 3.5,
    });

    this.effects.set('explosion_large', {
      name: 'Large Explosion',
      duration: 3.0,
      intensity: 1.0,
      color: { r: 1.0, g: 0.4, b: 0.1 },
      particleCount: 300,
      soundEffect: 'explosion_large',
      screenShake: 0.8,
      lightIntensity: 5.0,
    });

    // Impact effects
    this.effects.set('impact_light', {
      name: 'Light Impact',
      duration: 0.8,
      intensity: 0.4,
      color: { r: 0.8, g: 0.9, b: 1.0 },
      particleCount: 30,
      soundEffect: 'impact_light',
      screenShake: 0.1,
      lightIntensity: 1.5,
    });

    this.effects.set('impact_heavy', {
      name: 'Heavy Impact',
      duration: 1.2,
      intensity: 0.7,
      color: { r: 1.0, g: 0.7, b: 0.3 },
      particleCount: 80,
      soundEffect: 'impact_heavy',
      screenShake: 0.4,
      lightIntensity: 2.8,
    });

    // Skill effects
    this.effects.set('skill_dash', {
      name: 'Dash Skill',
      duration: 0.6,
      intensity: 0.8,
      color: { r: 0.2, g: 0.8, b: 1.0 },
      particleCount: 40,
      soundEffect: 'skill_dash',
      screenShake: 0.2,
      lightIntensity: 2.0,
    });

    this.effects.set('skill_shield', {
      name: 'Shield Skill',
      duration: 2.5,
      intensity: 0.6,
      color: { r: 0.4, g: 0.8, b: 1.0 },
      particleCount: 60,
      soundEffect: 'skill_shield',
      screenShake: 0.0,
      lightIntensity: 1.8,
    });

    this.effects.set('skill_magnet', {
      name: 'Magnet Skill',
      duration: 3.0,
      intensity: 0.7,
      color: { r: 0.8, g: 0.2, b: 1.0 },
      particleCount: 100,
      soundEffect: 'skill_magnet',
      screenShake: 0.1,
      lightIntensity: 2.5,
    });

    // Tattoo activation effects
    this.effects.set('tattoo_activation', {
      name: 'Tattoo Activation',
      duration: 2.0,
      intensity: 0.9,
      color: { r: 1.0, g: 0.8, b: 1.0 },
      particleCount: 120,
      soundEffect: 'tattoo_activation',
      screenShake: 0.3,
      lightIntensity: 3.0,
    });

    // Ring commit effects
    this.effects.set('ring_commit_1', {
      name: 'Ring 1 Commit',
      duration: 1.5,
      intensity: 0.5,
      color: { r: 0.2, g: 1.0, b: 0.4 },
      particleCount: 80,
      soundEffect: 'ring_commit_1',
      screenShake: 0.2,
      lightIntensity: 2.2,
    });

    this.effects.set('ring_commit_2', {
      name: 'Ring 2 Commit',
      duration: 2.0,
      intensity: 0.7,
      color: { r: 0.2, g: 0.6, b: 1.0 },
      particleCount: 150,
      soundEffect: 'ring_commit_2',
      screenShake: 0.4,
      lightIntensity: 3.5,
    });

    this.effects.set('ring_commit_3', {
      name: 'Ring 3 Commit',
      duration: 2.5,
      intensity: 0.9,
      color: { r: 1.0, g: 0.4, b: 0.2 },
      particleCount: 250,
      soundEffect: 'ring_commit_3',
      screenShake: 0.6,
      lightIntensity: 4.8,
    });

    // Death effects
    this.effects.set('death_splash', {
      name: 'Death Splash',
      duration: 2.5,
      intensity: 1.0,
      color: { r: 0.8, g: 0.2, b: 0.2 },
      particleCount: 200,
      soundEffect: 'death_splash',
      screenShake: 0.7,
      lightIntensity: 4.0,
    });

    // Level up effects
    this.effects.set('level_up', {
      name: 'Level Up',
      duration: 3.0,
      intensity: 1.0,
      color: { r: 1.0, g: 1.0, b: 0.2 },
      particleCount: 300,
      soundEffect: 'level_up',
      screenShake: 0.5,
      lightIntensity: 5.5,
    });
  }

  private initializeKeyframes() {
    // Explosion keyframes
    this.keyframes.set('explosion_small', [
      { time: 0.0, scale: 0.1, opacity: 0.0, color: { r: 1.0, g: 1.0, b: 0.8 }, emission: 0.0 },
      { time: 0.1, scale: 0.5, opacity: 1.0, color: { r: 1.0, g: 0.9, b: 0.6 }, emission: 2.0 },
      { time: 0.3, scale: 1.2, opacity: 0.8, color: { r: 1.0, g: 0.7, b: 0.4 }, emission: 1.5 },
      { time: 0.6, scale: 1.5, opacity: 0.4, color: { r: 0.8, g: 0.5, b: 0.2 }, emission: 0.8 },
      { time: 1.0, scale: 2.0, opacity: 0.0, color: { r: 0.5, g: 0.3, b: 0.1 }, emission: 0.0 },
      { time: 1.5, scale: 2.5, opacity: 0.0, color: { r: 0.2, g: 0.1, b: 0.05 }, emission: 0.0 },
    ]);

    // Impact keyframes
    this.keyframes.set('impact_light', [
      { time: 0.0, scale: 0.05, opacity: 0.0, color: { r: 0.9, g: 0.9, b: 1.0 }, emission: 0.0 },
      { time: 0.05, scale: 0.3, opacity: 1.0, color: { r: 0.8, g: 0.8, b: 1.0 }, emission: 1.5 },
      { time: 0.2, scale: 0.8, opacity: 0.7, color: { r: 0.7, g: 0.7, b: 0.9 }, emission: 0.8 },
      { time: 0.4, scale: 1.0, opacity: 0.3, color: { r: 0.6, g: 0.6, b: 0.8 }, emission: 0.3 },
      { time: 0.8, scale: 1.2, opacity: 0.0, color: { r: 0.4, g: 0.4, b: 0.6 }, emission: 0.0 },
    ]);

    // Skill dash keyframes
    this.keyframes.set('skill_dash', [
      { time: 0.0, scale: 0.1, opacity: 0.0, color: { r: 0.2, g: 0.8, b: 1.0 }, emission: 0.0 },
      { time: 0.1, scale: 0.8, opacity: 1.0, color: { r: 0.3, g: 0.9, b: 1.0 }, emission: 2.5 },
      { time: 0.3, scale: 1.5, opacity: 0.6, color: { r: 0.2, g: 0.7, b: 0.9 }, emission: 1.2 },
      { time: 0.6, scale: 2.0, opacity: 0.2, color: { r: 0.1, g: 0.5, b: 0.7 }, emission: 0.4 },
      { time: 0.6, scale: 2.5, opacity: 0.0, color: { r: 0.05, g: 0.3, b: 0.5 }, emission: 0.0 },
    ]);

    // Tattoo activation keyframes
    this.keyframes.set('tattoo_activation', [
      { time: 0.0, scale: 0.2, opacity: 0.0, color: { r: 0.8, g: 0.6, b: 1.0 }, emission: 0.0 },
      { time: 0.2, scale: 0.6, opacity: 0.8, color: { r: 1.0, g: 0.8, b: 1.0 }, emission: 1.5 },
      { time: 0.5, scale: 1.2, opacity: 1.0, color: { r: 1.0, g: 0.9, b: 1.0 }, emission: 3.0 },
      { time: 1.0, scale: 1.8, opacity: 0.6, color: { r: 0.9, g: 0.7, b: 0.9 }, emission: 1.8 },
      { time: 1.5, scale: 2.2, opacity: 0.3, color: { r: 0.7, g: 0.5, b: 0.7 }, emission: 0.8 },
      { time: 2.0, scale: 2.5, opacity: 0.0, color: { r: 0.5, g: 0.3, b: 0.5 }, emission: 0.0 },
    ]);

    // Ring commit keyframes (Ring 3 - most spectacular)
    this.keyframes.set('ring_commit_3', [
      { time: 0.0, scale: 0.1, opacity: 0.0, color: { r: 1.0, g: 0.8, b: 0.4 }, emission: 0.0 },
      { time: 0.3, scale: 0.8, opacity: 0.9, color: { r: 1.0, g: 0.7, b: 0.3 }, emission: 2.5 },
      { time: 0.6, scale: 1.5, opacity: 1.0, color: { r: 1.0, g: 0.6, b: 0.2 }, emission: 4.0 },
      { time: 1.0, scale: 2.2, opacity: 0.8, color: { r: 0.9, g: 0.5, b: 0.2 }, emission: 3.2 },
      { time: 1.5, scale: 2.8, opacity: 0.5, color: { r: 0.8, g: 0.4, b: 0.1 }, emission: 1.8 },
      { time: 2.0, scale: 3.2, opacity: 0.2, color: { r: 0.6, g: 0.3, b: 0.1 }, emission: 0.8 },
      { time: 2.5, scale: 3.5, opacity: 0.0, color: { r: 0.4, g: 0.2, b: 0.05 }, emission: 0.0 },
    ]);
  }

  // Play visual effect
  playEffect(effectId: string, position: { x: number; y: number; z: number }, options: Partial<EffectConfig> = {}): string {
    const config = this.effects.get(effectId);
    if (!config) {
      console.warn(`Effect not found: ${effectId}`);
      return '';
    }

    const activeEffectId = Math.random().toString(36).substr(2, 9);
    const activeEffect: ActiveEffect = {
      id: activeEffectId,
      config: { ...config, ...options },
      position,
      startTime: Date.now(),
      currentTime: 0,
      keyframes: this.keyframes.get(effectId) || [],
    };

    this.activeEffects.set(activeEffectId, activeEffect);

    // Trigger sound effect
    if (activeEffect.config.soundEffect) {
      this.playSoundEffect(activeEffect.config.soundEffect, position);
    }

    // Trigger screen shake
    if (activeEffect.config.screenShake) {
      this.triggerScreenShake(activeEffect.config.screenShake);
    }

    // Create dynamic light
    if (activeEffect.config.lightIntensity) {
      this.createDynamicLight(position, activeEffect.config.color, activeEffect.config.lightIntensity);
    }

    console.log(`🎆 Playing effect: ${config.name} at position (${position.x}, ${position.y}, ${position.z})`);
    return activeEffectId;
  }

  // Update active effects
  updateEffects(deltaTime: number) {
    const now = Date.now();
    const effectsToRemove: string[] = [];

    this.activeEffects.forEach((effect, id) => {
      effect.currentTime = (now - effect.startTime) / 1000;

      // Check if effect is finished
      if (effect.currentTime >= effect.config.duration) {
        effectsToRemove.push(id);
      }
    });

    // Remove finished effects
    effectsToRemove.forEach(id => {
      this.activeEffects.delete(id);
    });
  }

  // Get current effect state for rendering
  getEffectState(effectId: string): EffectRenderState | null {
    const effect = this.activeEffects.get(effectId);
    if (!effect) return null;

    const progress = effect.currentTime / effect.config.duration;
    const keyframe = this.interpolateKeyframes(effect.keyframes, effect.currentTime);

    return {
      position: effect.position,
      scale: keyframe.scale,
      opacity: keyframe.opacity,
      color: keyframe.color,
      emission: keyframe.emission,
      progress,
      particleCount: Math.floor(effect.config.particleCount * (1.0 - progress * 0.5)),
    };
  }

  private interpolateKeyframes(keyframes: EffectKeyframe[], time: number): EffectKeyframe {
    if (keyframes.length === 0) {
      return { time: 0, scale: 1.0, opacity: 1.0, color: { r: 1, g: 1, b: 1 }, emission: 0 };
    }

    if (time <= keyframes[0].time) {
      return keyframes[0];
    }

    if (time >= keyframes[keyframes.length - 1].time) {
      return keyframes[keyframes.length - 1];
    }

    // Find surrounding keyframes
    for (let i = 0; i < keyframes.length - 1; i++) {
      const current = keyframes[i];
      const next = keyframes[i + 1];

      if (time >= current.time && time <= next.time) {
        const t = (time - current.time) / (next.time - current.time);
        return {
          time,
          scale: this.lerp(current.scale, next.scale, t),
          opacity: this.lerp(current.opacity, next.opacity, t),
          color: {
            r: this.lerp(current.color.r, next.color.r, t),
            g: this.lerp(current.color.g, next.color.g, t),
            b: this.lerp(current.color.b, next.color.b, t),
          },
          emission: this.lerp(current.emission, next.emission, t),
        };
      }
    }

    return keyframes[keyframes.length - 1];
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private playSoundEffect(soundId: string, position: { x: number; y: number; z: number }) {
    // This would interface with the audio system
    console.log(`🔊 Playing sound effect: ${soundId} at position (${position.x}, ${position.y}, ${position.z})`);
  }

  private triggerScreenShake(intensity: number) {
    // This would interface with the camera system
    console.log(`📳 Screen shake triggered with intensity: ${intensity}`);
  }

  private createDynamicLight(position: { x: number; y: number; z: number }, color: { r: number; g: number; b: number }, intensity: number) {
    // This would interface with the lighting system
    console.log(`💡 Creating dynamic light at position (${position.x}, ${position.y}, ${position.z}) with color (${color.r}, ${color.g}, ${color.b}) and intensity ${intensity}`);
  }

  // Special effect combinations
  playComboEffect(combo: string, position: { x: number; y: number; z: number }): string[] {
    const effectIds: string[] = [];

    switch (combo) {
      case 'perfect_match':
        effectIds.push(this.playEffect('tattoo_activation', position, { intensity: 1.2 }));
        effectIds.push(this.playEffect('impact_light', position, { intensity: 0.8 }));
        break;

      case 'skill_kill':
        effectIds.push(this.playEffect('explosion_medium', position, { intensity: 0.9 }));
        effectIds.push(this.playEffect('skill_dash', position, { intensity: 0.7 }));
        break;

      case 'ring_commit_ceremony':
        effectIds.push(this.playEffect('ring_commit_3', position, { intensity: 1.0 }));
        effectIds.push(this.playEffect('tattoo_activation', position, { intensity: 0.8 }));
        effectIds.push(this.playEffect('level_up', position, { intensity: 0.6 }));
        break;

      case 'death_spectacular':
        effectIds.push(this.playEffect('death_splash', position, { intensity: 1.0 }));
        effectIds.push(this.playEffect('explosion_large', position, { intensity: 0.8 }));
        break;

      case 'level_up_celebration':
        effectIds.push(this.playEffect('level_up', position, { intensity: 1.0 }));
        effectIds.push(this.playEffect('tattoo_activation', position, { intensity: 0.7 }));
        effectIds.push(this.playEffect('ring_commit_2', position, { intensity: 0.5 }));
        break;
    }

    return effectIds;
  }

  // Get all available effects
  getAvailableEffects(): string[] {
    return Array.from(this.effects.keys());
  }

  // Get effect configuration
  getEffectConfig(effectId: string): EffectConfig | undefined {
    return this.effects.get(effectId);
  }

  // Stop specific effect
  stopEffect(effectId: string) {
    this.activeEffects.delete(effectId);
  }

  // Stop all effects
  stopAllEffects() {
    this.activeEffects.clear();
  }

  // Get active effects count
  getActiveEffectsCount(): number {
    return this.activeEffects.size;
  }

  // Performance monitoring
  getPerformanceMetrics() {
    return {
      activeEffects: this.activeEffects.size,
      totalEffects: this.effects.size,
      averageParticles: Array.from(this.activeEffects.values()).reduce((sum, effect) => sum + effect.config.particleCount, 0) / Math.max(1, this.activeEffects.size),
    };
  }
}

interface ActiveEffect {
  id: string;
  config: EffectConfig;
  position: { x: number; y: number; z: number };
  startTime: number;
  currentTime: number;
  keyframes: EffectKeyframe[];
}

interface EffectRenderState {
  position: { x: number; y: number; z: number };
  scale: number;
  opacity: number;
  color: { r: number; g: number; b: number };
  emission: number;
  progress: number;
  particleCount: number;
}

export const visualEffectsLibrary = new VisualEffectsLibrary();
