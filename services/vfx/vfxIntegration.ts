/**
 * VFX INTEGRATION - Premium Game Juice
 * 
 * Integrating all VFX systems into the main game loop
 * Creating seamless visual feedback for every player action
 */

import { GameState, Player } from '../../types';
import { RingId } from '../cjr/cjrTypes';
import { TattooId } from '../cjr/cjrTypes';
import { vfxSystem } from './vfxSystem';
import { tattooVFXSystem } from './tattooVFX';

// ============================================
// VFX INTEGRATION MANAGER
// ============================================

export class VFXIntegrationManager {
  private lastRingCommit: Map<string, number> = new Map();
  private lastTattooActivation: Map<string, Map<TattooId, number>> = new Map();
  private vfxEnabled: boolean = true;
  private qualityLevel: 'low' | 'medium' | 'high' | 'ultra' = 'high';

  constructor() {
    // Initialize tracking maps
  }

  /**
   * Enable/disable VFX for performance optimization
   */
  setVFXEnabled(enabled: boolean): void {
    this.vfxEnabled = enabled;
  }

  /**
   * Set quality level for different devices
   */
  setQualityLevel(level: 'low' | 'medium' | 'high' | 'ultra'): void {
    this.qualityLevel = level;
  }

  /**
   * Handle ring commit VFX - The most important visual feedback
   */
  handleRingCommit(player: Player, ringId: RingId, state: GameState): void {
    if (!this.vfxEnabled) return;

    const lastCommit = this.lastRingCommit.get(player.id) || 0;
    const now = Date.now();

    // Prevent spam - minimum 1 second between commits
    if (now - lastCommit < 1000) return;

    // Play ring commit VFX
    vfxSystem.playRingCommitVFX(player, ringId, state);

    // Update last commit time
    this.lastRingCommit.set(player.id, now);

    // Create additional effects based on quality level
    if (this.qualityLevel === 'high' || this.qualityLevel === 'ultra') {
      this.createRingCommitEnhancements(player, ringId, state);
    }
  }

  /**
   * Handle tattoo activation VFX
   */
  handleTattooActivation(player: Player, tattooId: TattooId, state: GameState): void {
    if (!this.vfxEnabled) return;

    const playerTattoos = this.lastTattooActivation.get(player.id) || new Map();
    const lastActivation = playerTattoos.get(tattooId) || 0;
    const now = Date.now();

    // Prevent spam - minimum 2 seconds between same tattoo activation
    if (now - lastActivation < 2000) return;

    // Play tattoo activation VFX
    tattooVFXSystem.playTattooActivationVFX(player, tattooId, state);

    // Update last activation time
    playerTattoos.set(tattooId, now);
    this.lastTattooActivation.set(player.id, playerTattoos);

    // Create synergy effects if applicable
    this.checkTattooSynergies(player, tattooId, state);
  }

  /**
   * Create enhancements for ring commit based on quality level
   */
  private createRingCommitEnhancements(player: Player, ringId: RingId, state: GameState): void {
    // Ultra quality gets additional effects
    if (this.qualityLevel === 'ultra') {
      // Create light rays
      this.createLightRays(player.position, ringId, state);
      
      // Create environmental effects
      this.createEnvironmentalEffects(player.position, ringId, state);
    }
  }

  /**
   * Create light rays for ultra quality
   */
  private createLightRays(position: any, ringId: RingId, state: GameState): void {
    const rayCount = 8;
    const colors = ['#FFD700', '#FFA500', '#FF6347', '#FF4500'];
    
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const color = colors[i % colors.length];
      
      // Create ray particles
      const ray = {
        id: `ray_${i}_${Date.now()}`,
        position: { ...position },
        velocity: {
          x: Math.cos(angle) * 200,
          y: Math.sin(angle) * 200
        },
        radius: 2,
        color,
        life: 1.5,
        maxLife: 1.5,
        isDead: false,
        trail: [],
        isLightRay: true,
        rayLength: 100,
        rayWidth: 3
      };
      
      state.particles.push(ray);
    }
  }

  /**
   * Create environmental effects for ring commit
   */
  private createEnvironmentalEffects(position: any, ringId: RingId, state: GameState): void {
    // Create ground impact effects
    const impactCount = 12;
    
    for (let i = 0; i < impactCount; i++) {
      const angle = (i / impactCount) * Math.PI * 2;
      const distance = 50 + Math.random() * 30;
      
      const x = position.x + Math.cos(angle) * distance;
      const y = position.y + Math.sin(angle) * distance;
      
      const impact = {
        id: `impact_${i}_${Date.now()}`,
        position: { x, y },
        velocity: { x: 0, y: 0 },
        radius: 5,
        color: '#FFFFFF',
        life: 1.0,
        maxLife: 1.0,
        isDead: false,
        trail: [],
        isGroundImpact: true,
        impactSize: 10
      };
      
      state.particles.push(impact);
    }
  }

  /**
   * Check for tattoo synergies and create additional effects
   */
  private checkTattooSynergies(player: Player, activatedTattoo: TattooId, state: GameState): void {
    // Define some basic synergies
    const synergies: Array<{ tattoos: [TattooId, TattooId]; effect: string }> = [
      {
        tattoos: [TattooId.FilterInk, TattooId.NeutralMastery],
        effect: 'purification_burst'
      },
      {
        tattoos: [TattooId.Overdrive, TattooId.PigmentBomb],
        effect: 'explosive_speed'
      },
      {
        tattoos: [TattooId.PerfectMatch, TattooId.CatalystSense],
        effect: 'golden_attraction'
      }
    ];

    // Check if player has synergy tattoos
    for (const synergy of synergies) {
      if (player.tattoos.includes(synergy.tattoos[0]) && 
          player.tattoos.includes(synergy.tattoos[1])) {
        
        // Check if the activated tattoo is part of this synergy
        if (synergy.tattoos.includes(activatedTattoo)) {
          this.createSynergyEffect(player, synergy.effect, state);
        }
      }
    }
  }

  /**
   * Create synergy effects
   */
  private createSynergyEffect(player: Player, effect: string, state: GameState): void {
    switch (effect) {
      case 'purification_burst':
        this.createPurificationBurst(player, state);
        break;
      case 'explosive_speed':
        this.createExplosiveSpeed(player, state);
        break;
      case 'golden_attraction':
        this.createGoldenAttraction(player, state);
        break;
    }
  }

  private createPurificationBurst(player: Player, state: GameState): void {
    // Create white purification particles
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const particle = {
        id: `purify_${i}_${Date.now()}`,
        position: { ...player.position },
        velocity: {
          x: Math.cos(angle) * 100,
          y: Math.sin(angle) * 100
        },
        radius: 6,
        color: '#FFFFFF',
        life: 2.0,
        maxLife: 2.0,
        isDead: false,
        trail: [],
        isPurification: true,
        glowIntensity: 0.8
      };
      
      state.particles.push(particle);
    }
  }

  private createExplosiveSpeed(player: Player, state: GameState): void {
    // Create orange speed trail with explosion
    for (let i = 0; i < 15; i++) {
      const particle = {
        id: `speed_${i}_${Date.now()}`,
        position: { ...player.position },
        velocity: {
          x: player.velocity.x * 0.5 + (Math.random() - 0.5) * 50,
          y: player.velocity.y * 0.5 + (Math.random() - 0.5) * 50
        },
        radius: 4,
        color: '#FF6B35',
        life: 1.0,
        maxLife: 1.0,
        isDead: false,
        trail: [],
        isSpeedTrail: true,
        trailIntensity: 1.2
      };
      
      state.particles.push(particle);
    }
  }

  private createGoldenAttraction(player: Player, state: GameState): void {
    // Create golden attraction field
    for (let i = 0; i < 25; i++) {
      const angle = (i / 25) * Math.PI * 2;
      const radius = 30 + Math.random() * 20;
      
      const x = player.position.x + Math.cos(angle) * radius;
      const y = player.position.y + Math.sin(angle) * radius;
      
      const particle = {
        id: `golden_${i}_${Date.now()}`,
        position: { x, y },
        velocity: {
          x: -Math.cos(angle) * 80,
          y: -Math.sin(angle) * 80
        },
        radius: 3,
        color: '#FFD700',
        life: 1.5,
        maxLife: 1.5,
        isDead: false,
        trail: [],
        isGoldenAttraction: true,
        attractionForce: 1.5
      };
      
      state.particles.push(particle);
    }
  }

  /**
   * Update all VFX systems
   */
  update(state: GameState, dt: number): void {
    if (!this.vfxEnabled) return;

    // Update main VFX system
    vfxSystem.updateEffects(state, dt);

    // Update tattoo VFX system
    tattooVFXSystem.updateEffects(state, dt);

    // Clean up old tracking data
    this.cleanupTrackingData();
  }

  /**
   * Clean up old tracking data to prevent memory leaks
   */
  private cleanupTrackingData(): void {
    const now = Date.now();
    const maxAge = 60000; // 1 minute

    // Clean up old ring commit tracking
    for (const [playerId, lastCommit] of this.lastRingCommit.entries()) {
      if (now - lastCommit > maxAge) {
        this.lastRingCommit.delete(playerId);
      }
    }

    // Clean up old tattoo activation tracking
    for (const [playerId, tattoos] of this.lastTattooActivation.entries()) {
      for (const [tattooId, lastActivation] of tattoos.entries()) {
        if (now - lastActivation > maxAge) {
          tattoos.delete(tattooId);
        }
      }
      
      if (tattoos.size === 0) {
        this.lastTattooActivation.delete(playerId);
      }
    }
  }

  /**
   * Get screen shake offset for camera
   */
  getScreenShakeOffset(): { x: number; y: number } {
    return vfxSystem.getScreenShakeOffset();
  }

  /**
   * Get VFX statistics for debugging
   */
  getVFXStats(): {
    enabled: boolean;
    qualityLevel: string;
    activeEffects: number;
    trackedPlayers: number;
  } {
    return {
      enabled: this.vfxEnabled,
      qualityLevel: this.qualityLevel,
      activeEffects: vfxSystem['activeEffects'].size + tattooVFXSystem['activeEffects'].size,
      trackedPlayers: this.lastRingCommit.size
    };
  }
}

// ============================================
// GLOBAL VFX INTEGRATION INSTANCE
// ============================================

export const vfxIntegrationManager = new VFXIntegrationManager();

// ============================================
// EXTENDED PARTICLE TYPES
// ============================================

declare module '../../types' {
  interface Particle {
    // Ring commit enhancements
    isLightRay?: boolean;
    rayLength?: number;
    rayWidth?: number;
    isGroundImpact?: boolean;
    impactSize?: number;
    
    // Synergy effects
    isPurification?: boolean;
    isSpeedTrail?: boolean;
    trailIntensity?: number;
    isGoldenAttraction?: boolean;
    attractionForce?: number;
  }
}
