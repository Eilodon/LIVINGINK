import { Vector2 } from '../types';

class AudioManager {
  private audioContext: AudioContext | null = null;
  private bgmOscillators: OscillatorNode[] = [];
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Lazy init on first user interaction usually, but we'll try to init
    try {
      if (typeof window === 'undefined') return;
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.sfxGain = this.audioContext.createGain();
      this.bgmGain = this.audioContext.createGain();

      this.masterGain.connect(this.audioContext.destination);
      this.sfxGain.connect(this.masterGain);
      this.bgmGain.connect(this.masterGain);

      this.masterGain.gain.value = 0.4;
      this.sfxGain.gain.value = 1.0;
      this.bgmGain.gain.value = 0.06;
    } catch (e) {
      console.error("Audio API not supported");
    }
  }

  public resume() {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  private getSpatial(volume: number, position?: Vector2, listener?: Vector2) {
    if (!position || !listener) {
      return { volume, pan: 0 };
    }
    const dx = position.x - listener.x;
    const dy = position.y - listener.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 900;
    const distanceFactor = Math.max(0, 1 - Math.min(dist / maxDistance, 1));
    const adjustedVolume = volume * (0.25 + distanceFactor * 0.75);
    const pan = Math.max(-1, Math.min(1, dx / maxDistance));
    return { volume: adjustedVolume, pan };
  }

  // Generate a procedural sound
  private playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    startTime: number = 0,
    volume: number = 1,
    position?: Vector2,
    listener?: Vector2
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const output = this.sfxGain || this.masterGain;
    if (!output) return;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioContext.currentTime + startTime);

    const spatial = this.getSpatial(volume, position, listener);
    gain.gain.setValueAtTime(spatial.volume, this.audioContext.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + startTime + duration);

    osc.connect(gain);
    if (this.audioContext.createStereoPanner) {
      const panner = this.audioContext.createStereoPanner();
      panner.pan.value = spatial.pan;
      gain.connect(panner);
      panner.connect(output);
    } else {
      gain.connect(output);
    }

    osc.start(this.audioContext.currentTime + startTime);
    osc.stop(this.audioContext.currentTime + startTime + duration);
  }

  public playEject(position?: Vector2, listener?: Vector2) {
    // "Pew" sound
    if (!this.audioContext) return;
    this.playTone(600, 'sine', 0.1, 0, 0.5, position, listener);
    this.playTone(300, 'triangle', 0.1, 0.05, 0.3, position, listener);
  }

  public playEat(position?: Vector2, listener?: Vector2) {
    // "Chime" sound
    this.playTone(800 + Math.random() * 200, 'sine', 0.1, 0, 0.12, position, listener);
  }

  public playKill(position?: Vector2, listener?: Vector2) {
    // Deep Gong/Impact
    this.playTone(120, 'sawtooth', 0.35, 0, 0.7, position, listener);
    this.playTone(60, 'sine', 0.8, 0.05, 0.9, position, listener);
    this.playTone(900, 'triangle', 0.08, 0.02, 0.15, position, listener);
  }

  public playSkill(position?: Vector2, listener?: Vector2) {
    // Whoosh
    if (!this.audioContext) return;
    this.playTone(240, 'sawtooth', 0.25, 0, 0.35, position, listener);
    this.playTone(640, 'triangle', 0.18, 0.02, 0.25, position, listener);
  }

  public playWarning() {
    // Siren alert for Round Change
    if (!this.audioContext || !this.masterGain) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, this.audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(880, this.audioContext.currentTime + 0.5);
    osc.frequency.linearRampToValueAtTime(440, this.audioContext.currentTime + 1.0);
    
    gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1.0);

    osc.connect(gain);
    gain.connect(this.sfxGain || this.masterGain);
    osc.start();
    osc.stop(this.audioContext.currentTime + 1.0);
  }

  public playDamage(position?: Vector2, listener?: Vector2) {
    if (!this.audioContext) return;
    this.playTone(220, 'square', 0.12, 0, 0.3, position, listener);
    this.playTone(140, 'sine', 0.18, 0.02, 0.25, position, listener);
  }

  public setBgmIntensity(level: number) {
    if (!this.bgmGain) return;
    const clamped = Math.max(1, Math.min(4, level));
    this.bgmGain.gain.value = 0.05 + (clamped - 1) * 0.03;
  }

  public startBGM() {
    // Simple drone/ambient background
    if (!this.audioContext || !this.bgmGain || this.bgmOscillators.length > 0) return;
    
    const freqs = [110, 164.8, 196, 220]; // A3, E3, G3, A4 (Am7ish)
    
    freqs.forEach(f => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = f;
      
      // LFO for movement
      const lfo = this.audioContext!.createOscillator();
      lfo.frequency.value = 0.1 + Math.random() * 0.1;
      const lfoGain = this.audioContext!.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();

      gain.gain.value = 0.05;

      osc.connect(gain);
      gain.connect(this.bgmGain!);
      osc.start();
      
      this.bgmOscillators.push(osc);
    });
  }
}

export const audioManager = new AudioManager();
