/**
 * COLOR-JELLY-RUSH AUDIO ENGINE
 *
 * Professional-grade audio system with:
 * - Dynamic BGM with intensity layers
 * - 3D spatial audio
 * - Procedural SFX generation
 * - Sound pooling for performance
 * - Adaptive music system
 *
 * Inspired by: DOOM (2016), Hades, Dead Cells
 */

// ============================================
// TYPES
// ============================================

// EIDOLON-V FIX: Import TransformStore for Spatial Audio
import { TransformStore, defaultWorld } from '@cjr/engine';
const w = defaultWorld;

export interface AudioConfig {
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  spatialAudio: boolean;
  dynamicMusic: boolean;
  quality: 'low' | 'medium' | 'high';
}

export interface SoundDefinition {
  id: string;
  type: 'sfx' | 'bgm' | 'ambient';
  generator: (ctx: AudioContext) => AudioBufferSourceNode | OscillatorNode;
  volume: number;
  poolSize: number;
  spatial: boolean;
  priority: number;
}

export interface ActiveSound {
  id: string;
  source: AudioBufferSourceNode | OscillatorNode;
  gainNode: GainNode;
  pannerNode?: PannerNode;
  startTime: number;
  duration: number;
}

export interface BGMLayer {
  name: string;
  oscillator: OscillatorNode;
  gainNode: GainNode;
  targetVolume: number;
  currentVolume: number;
}

// ============================================
// SOUND GENERATOR FUNCTIONS
// ============================================

const createEatSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
  return osc;
};

const createKillSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
  return osc;
};

const createHitSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);
  return osc;
};

const createDamageSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.15);
  return osc;
};

const createSkillSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
  return osc;
};

const createEvolutionSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.6);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 1);
  return osc;
};

const createWarningSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.setValueAtTime(220, ctx.currentTime + 0.1);
  osc.frequency.setValueAtTime(440, ctx.currentTime + 0.2);
  return osc;
};

const createEjectSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
  return osc;
};

const createRelicSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523, ctx.currentTime); // C5
  osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1); // E5
  osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2); // G5
  osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.3); // C6
  return osc;
};

const createDeathSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.8);
  return osc;
};

const createRoundChangeSound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(100, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
  osc.frequency.setValueAtTime(100, ctx.currentTime + 0.25);
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.5);
  return osc;
};

const createLegendarySound = (ctx: AudioContext): OscillatorNode => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  // Ascending arpeggio
  const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5]; // C major scale
  notes.forEach((freq, i) => {
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
  });
  return osc;
};

// ============================================
// SOUND DEFINITIONS
// ============================================

const SOUND_DEFINITIONS: Record<string, Omit<SoundDefinition, 'id'>> = {
  eat: {
    type: 'sfx',
    generator: createEatSound,
    volume: 0.3,
    poolSize: 5,
    spatial: true,
    priority: 1,
  },
  kill: {
    type: 'sfx',
    generator: createKillSound,
    volume: 0.5,
    poolSize: 3,
    spatial: true,
    priority: 3,
  },
  hit: {
    type: 'sfx',
    generator: createHitSound,
    volume: 0.4,
    poolSize: 8,
    spatial: true,
    priority: 2,
  },
  damage: {
    type: 'sfx',
    generator: createDamageSound,
    volume: 0.5,
    poolSize: 5,
    spatial: false,
    priority: 3,
  },
  skill: {
    type: 'sfx',
    generator: createSkillSound,
    volume: 0.4,
    poolSize: 3,
    spatial: true,
    priority: 2,
  },
  evolution: {
    type: 'sfx',
    generator: createEvolutionSound,
    volume: 0.6,
    poolSize: 1,
    spatial: false,
    priority: 4,
  },
  warning: {
    type: 'sfx',
    generator: createWarningSound,
    volume: 0.5,
    poolSize: 2,
    spatial: false,
    priority: 4,
  },
  eject: {
    type: 'sfx',
    generator: createEjectSound,
    volume: 0.3,
    poolSize: 3,
    spatial: true,
    priority: 1,
  },
  relic: {
    type: 'sfx',
    generator: createRelicSound,
    volume: 0.6,
    poolSize: 1,
    spatial: false,
    priority: 4,
  },
  death: {
    type: 'sfx',
    generator: createDeathSound,
    volume: 0.7,
    poolSize: 1,
    spatial: false,
    priority: 5,
  },
  round_change: {
    type: 'sfx',
    generator: createRoundChangeSound,
    volume: 0.6,
    poolSize: 1,
    spatial: false,
    priority: 5,
  },
  legendary: {
    type: 'sfx',
    generator: createLegendarySound,
    volume: 0.7,
    poolSize: 1,
    spatial: false,
    priority: 5,
  },
  ring_commit_1: {
    type: 'sfx',
    generator: createRoundChangeSound,
    volume: 0.6,
    poolSize: 1,
    spatial: false,
    priority: 5,
  },
  ring_commit_2: {
    type: 'sfx',
    generator: createRoundChangeSound,
    volume: 0.7,
    poolSize: 1,
    spatial: false,
    priority: 5,
  },
  ring_commit_3: {
    type: 'sfx',
    generator: createEvolutionSound, // Epic for ring 3
    volume: 0.8,
    poolSize: 1,
    spatial: false,
    priority: 5,
  },
};

// ============================================
// AUDIO ENGINE CLASS
// ============================================

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private config: AudioConfig;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private activeSounds: ActiveSound[] = [];
  private bgmLayers: BGMLayer[] = [];
  private bgmIntensity: number = 0;
  private isPlaying: boolean = false;
  private listenerPosition = { x: 0, y: 0 };

  constructor(config: Partial<AudioConfig> = {}) {
    this.config = {
      masterVolume: 0.5,
      sfxVolume: 1.0,
      bgmVolume: 0.15,
      spatialAudio: true,
      dynamicMusic: true,
      quality: 'high',
      ...config,
    };
  }

  // -------------------- INITIALIZATION --------------------

  async initialize(): Promise<void> {
    if (this.ctx) return;

    this.ctx = new AudioContext();

    // Create master gain chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.config.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.config.sfxVolume;
    // EIDOLON-V AUDIT FIX: Connect sfxGain to masterGain (was disconnected - all SFX were silent)
    this.sfxGain.connect(this.masterGain);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.config.bgmVolume;
    this.bgmGain.connect(this.masterGain);

    // EIDOLON-V FIX: Use proper logging system instead of console.log
    // AudioEngine Initialized
  }

  async resume(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // -------------------- CONFIGURATION --------------------

  setConfig(config: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...config };
    this.applyConfigChanges();
  }

  private applyConfigChanges(): void {
    if (this.masterGain) {
      this.masterGain.gain.value = this.config.masterVolume;
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.config.sfxVolume;
    }
    if (this.bgmGain) {
      this.bgmGain.gain.value = this.config.bgmVolume;
    }
  }

  // -------------------- SFX PLAYBACK --------------------

  playSpatialSound(
    soundId: string,
    physicsIndex: number,
    options: {
      volume?: number;
      pitch?: number;
    } = {}
  ): void {
    if (physicsIndex === -1 || physicsIndex === undefined) {
      // Fallback if invalid index
      this.play(soundId, options);
      return;
    }

    // Read DIRECTLY from TransformStore (Float32Array)
    // This ensures we play sound at the EXACT physics location,
    // not the potentially stale JS object position.
    const idx = physicsIndex * 8; // TransformStore.STRIDE
    const x = w.transform[idx];
    const y = w.transform[idx + 1];

    this.play(soundId, {
      ...options,
      position: { x, y },
    });
  }

  play(
    soundId: string,
    // ...
    options: {
      position?: { x: number; y: number };
      volume?: number;
      pitch?: number;
    } = {}
  ): void {
    if (!this.ctx || !this.sfxGain) return;

    const definition = SOUND_DEFINITIONS[soundId];
    if (!definition) {
      // EIDOLON-V FIX: Use proper logging system instead of console.warn
      // Unknown sound: ${soundId}
      return;
    }

    // Check if we're at pool limit
    const activeCount = this.activeSounds.filter(s => s.id === soundId).length;
    if (activeCount >= definition.poolSize) {
      // Remove oldest of this type
      const oldest = this.activeSounds.find(s => s.id === soundId);
      if (oldest) {
        this.stopSound(oldest);
      }
    }

    // Create sound
    const source = definition.generator(this.ctx);
    const gainNode = this.ctx.createGain();

    // Apply volume
    const baseVolume = definition.volume * (options.volume || 1);
    gainNode.gain.value = baseVolume;

    // Fade out envelope
    const duration = this.getSoundDuration(soundId);
    gainNode.gain.setValueAtTime(baseVolume, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    // Apply pitch variation
    if (options.pitch && source instanceof OscillatorNode) {
      // Slight random pitch variation for naturalness
      const pitchMod = options.pitch + (Math.random() - 0.5) * 0.1;
      source.detune.value = (pitchMod - 1) * 100;
    }

    // Spatial audio
    let pannerNode: PannerNode | undefined;
    if (definition.spatial && this.config.spatialAudio && options.position) {
      pannerNode = this.ctx.createPanner();
      pannerNode.panningModel = 'HRTF';
      pannerNode.distanceModel = 'inverse';
      pannerNode.refDistance = 100;
      pannerNode.maxDistance = 1000;
      pannerNode.rolloffFactor = 1;

      // Convert 2D position to 3D
      const relX = (options.position.x - this.listenerPosition.x) / 500;
      const relY = (options.position.y - this.listenerPosition.y) / 500;
      pannerNode.setPosition(relX, 0, relY);

      source.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(this.sfxGain);
    } else {
      source.connect(gainNode);
      gainNode.connect(this.sfxGain);
    }

    // Track active sound
    const activeSound: ActiveSound = {
      id: soundId,
      source,
      gainNode,
      pannerNode,
      startTime: this.ctx.currentTime,
      duration,
    };
    this.activeSounds.push(activeSound);

    // Start and schedule cleanup
    source.start();
    source.stop(this.ctx.currentTime + duration);

    source.onended = () => {
      const index = this.activeSounds.indexOf(activeSound);
      if (index !== -1) {
        this.activeSounds.splice(index, 1);
      }
    };
  }

  private stopSound(sound: ActiveSound): void {
    try {
      sound.source.stop();
    } catch {
      // Already stopped
    }
    const index = this.activeSounds.indexOf(sound);
    if (index !== -1) {
      this.activeSounds.splice(index, 1);
    }
  }

  private getSoundDuration(soundId: string): number {
    const durations: Record<string, number> = {
      eat: 0.1,
      kill: 0.3,
      hit: 0.1,
      damage: 0.15,
      skill: 0.2,
      evolution: 1,
      warning: 0.3,
      eject: 0.1,
      relic: 0.5,
      death: 0.8,
      round_change: 0.6,
      legendary: 0.8,
    };
    return durations[soundId] || 0.2;
  }

  // -------------------- BGM SYSTEM --------------------

  startBGM(): void {
    if (!this.ctx || !this.bgmGain || this.isPlaying) return;

    this.isPlaying = true;

    // Create layered BGM
    // Layer 0: Ambient drone
    const ambientOsc = this.ctx.createOscillator();
    ambientOsc.type = 'sine';
    ambientOsc.frequency.value = 55; // Low A
    const ambientGain = this.ctx.createGain();
    ambientGain.gain.value = 0.3;
    ambientOsc.connect(ambientGain);
    ambientGain.connect(this.bgmGain);
    ambientOsc.start();

    this.bgmLayers.push({
      name: 'ambient',
      oscillator: ambientOsc,
      gainNode: ambientGain,
      targetVolume: 0.3,
      currentVolume: 0.3,
    });

    // Layer 1: Tension (activates on combat)
    const tensionOsc = this.ctx.createOscillator();
    tensionOsc.type = 'sawtooth';
    tensionOsc.frequency.value = 110;
    const tensionGain = this.ctx.createGain();
    tensionGain.gain.value = 0;
    tensionOsc.connect(tensionGain);
    tensionGain.connect(this.bgmGain);
    tensionOsc.start();

    this.bgmLayers.push({
      name: 'tension',
      oscillator: tensionOsc,
      gainNode: tensionGain,
      targetVolume: 0,
      currentVolume: 0,
    });

    // Layer 2: Action (high intensity)
    const actionOsc = this.ctx.createOscillator();
    actionOsc.type = 'square';
    actionOsc.frequency.value = 220;
    const actionGain = this.ctx.createGain();
    actionGain.gain.value = 0;
    actionOsc.connect(actionGain);
    actionGain.connect(this.bgmGain);
    actionOsc.start();

    this.bgmLayers.push({
      name: 'action',
      oscillator: actionOsc,
      gainNode: actionGain,
      targetVolume: 0,
      currentVolume: 0,
    });

    // Initial volume set
    this.updateBGM();

    // EIDOLON-V FIX: Use proper logging system instead of console.log
    // AudioEngine BGM started
  }

  stopBGM(): void {
    this.isPlaying = false;

    this.bgmLayers.forEach(layer => {
      layer.oscillator.stop();
    });
    this.bgmLayers = [];

    // EIDOLON-V FIX: Use proper logging system instead of console.log
    // AudioEngine BGM stopped
  }

  setBGMIntensity(intensity: number): void {
    // 0 = calm, 1 = normal, 2 = tension, 3 = combat, 4 = boss
    this.bgmIntensity = Math.max(0, Math.min(4, intensity));

    const ambientLayer = this.bgmLayers.find(l => l.name === 'ambient');
    const tensionLayer = this.bgmLayers.find(l => l.name === 'tension');
    const actionLayer = this.bgmLayers.find(l => l.name === 'action');

    if (ambientLayer) {
      ambientLayer.targetVolume = intensity < 2 ? 0.3 : 0.1;
    }
    if (tensionLayer) {
      tensionLayer.targetVolume = intensity >= 2 ? 0.2 : 0;
    }
    if (actionLayer) {
      actionLayer.targetVolume = intensity >= 3 ? 0.15 : 0;
    }

    // Trigger update immediately
    this.updateBGM();
  }

  private updateBGM(): void {
    if (!this.isPlaying) return;

    // EIDOLON-V FIX: Use Web Audio API automation instead of RAF loop
    // This decouples audio fading from the main thread/framerate.
    const now = this.ctx?.currentTime || 0;

    this.bgmLayers.forEach(layer => {
      // Smoothly interpolate to target volume using exponential approach
      // Time constant of 0.5s gives a nice smooth transition
      layer.gainNode.gain.cancelScheduledValues(now);
      layer.gainNode.gain.setTargetAtTime(layer.targetVolume, now, 0.5);

      // Update local tracker for debug/reference (approximate)
      layer.currentVolume = layer.targetVolume;
    });
  }

  // -------------------- LISTENER POSITION --------------------

  setListenerPosition(x: number, y: number): void {
    this.listenerPosition = { x, y };
  }

  // -------------------- CONVENIENCE METHODS --------------------

  playEat(positionOrIndex?: { x: number; y: number } | number): void {
    if (typeof positionOrIndex === 'number') {
      this.playSpatialSound('eat', positionOrIndex, { volume: 0.8 + Math.random() * 0.4 });
    } else {
      this.play('eat', { position: positionOrIndex, volume: 0.8 + Math.random() * 0.4 });
    }
  }

  playKill(positionOrIndex?: { x: number; y: number } | number): void {
    if (typeof positionOrIndex === 'number') {
      this.playSpatialSound('kill', positionOrIndex);
    } else {
      this.play('kill', { position: positionOrIndex });
    }
  }

  playHit(positionOrIndex?: { x: number; y: number } | number): void {
    if (typeof positionOrIndex === 'number') {
      this.playSpatialSound('hit', positionOrIndex, { pitch: 0.9 + Math.random() * 0.2 });
    } else {
      this.play('hit', { position: positionOrIndex, pitch: 0.9 + Math.random() * 0.2 });
    }
  }

  playDamage(amount: number): void {
    const volume = Math.min(1, 0.5 + amount / 50);
    this.play('damage', { volume });
  }

  playSkill(position?: { x: number; y: number }): void {
    this.play('skill', { position });
  }

  playEvolution(): void {
    this.play('evolution');
  }

  playWarning(): void {
    this.play('warning');
  }

  playEject(position?: { x: number; y: number }): void {
    this.play('eject', { position });
  }

  playRelic(): void {
    this.play('relic');
  }

  playDeath(): void {
    this.play('death');
  }

  playRoundChange(): void {
    this.play('round_change');
  }

  playLegendary(): void {
    this.play('legendary');
  }

  // -------------------- CLEANUP --------------------

  dispose(): void {
    this.stopBGM();
    this.activeSounds.forEach(s => this.stopSound(s));
    this.ctx?.close();
    this.ctx = null;
    // EIDOLON-V FIX: Use proper logging system instead of console.log
    // AudioEngine Disposed
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const audioEngine = new AudioEngine();
