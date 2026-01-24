/**
 * AUDIO EXCELLENCE SYSTEM
 * Dynamic soundtrack, spatial audio, Web Audio API mastery
 */

export interface AudioTheme {
  name: string;
  layers: AudioLayer[];
  transitions: AudioTransition[];
}

export interface AudioLayer {
  id: string;
  type: 'melody' | 'harmony' | 'rhythm' | 'ambient' | 'effect';
  gain: number;
  frequency: number;
  waveform: OscillatorType;
  envelope: ADSREnvelope;
  effects: AudioEffect[];
}

export interface ADSREnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface AudioEffect {
  type: 'reverb' | 'delay' | 'distortion' | 'filter' | 'compressor';
  params: Record<string, number>;
}

export interface AudioTransition {
  from: string;
  to: string;
  duration: number;
  curve: 'linear' | 'exponential' | 'sine';
}

export interface SpatialAudio {
  x: number;
  y: number;
  z: number;
  radius: number;
  cone: {
    innerAngle: number;
    outerAngle: number;
    outerGain: number;
  };
}

export class AudioExcellence {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private compressor: DynamicsCompressorNode;
  private analyser: AnalyserNode;
  private activeLayers: Map<string, AudioNode[]> = new Map();
  private spatialNodes: Map<string, PannerNode> = new Map();
  private currentTheme: AudioTheme | null = null;
  private isInitialized = false;
  private audioQuality: 'low' | 'medium' | 'high' | 'ultra' = 'high';
  private adaptiveMode = true;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.analyser = this.audioContext.createAnalyser();
    
    this.setupAudioPipeline();
    this.initializeAudioThemes();
  }

  private setupAudioPipeline() {
    // Master processing chain
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    
    // Configure compressor for professional sound
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    
    // Configure analyser
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    
    // Set initial master volume
    this.masterGain.gain.value = 0.7;
    
    this.isInitialized = true;
  }

  private initializeAudioThemes() {
    // This would be expanded with actual musical compositions
    // For now, we'll create procedural audio themes
  }

  // Create procedural audio layer
  createAudioLayer(layer: AudioLayer): AudioNode[] {
    const nodes: AudioNode[] = [];
    
    // Create oscillator
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = layer.waveform;
    oscillator.frequency.value = layer.frequency;
    
    // Create envelope
    const gainNode = this.audioContext.createGain();
    this.applyEnvelope(gainNode, layer.envelope);
    
    // Apply effects
    let currentNode: AudioNode = oscillator;
    nodes.push(currentNode);
    
    for (const effect of layer.effects) {
      const effectNode = this.createEffect(effect);
      if (effectNode) {
        currentNode.connect(effectNode);
        currentNode = effectNode;
        nodes.push(effectNode);
      }
    }
    
    // Connect to gain node
    currentNode.connect(gainNode);
    nodes.push(gainNode);
    
    // Connect to master gain
    gainNode.connect(this.masterGain);
    
    // Start oscillator
    oscillator.start();
    
    return nodes;
  }

  private applyEnvelope(gainNode: GainNode, envelope: ADSREnvelope) {
    const now = this.audioContext.currentTime;
    
    // Initial state
    gainNode.gain.setValueAtTime(0, now);
    
    // Attack
    gainNode.gain.linearRampToValueAtTime(1, now + envelope.attack);
    
    // Decay
    gainNode.gain.linearRampToValueAtTime(envelope.sustain, now + envelope.attack + envelope.decay);
  }

  private createEffect(effect: AudioEffect): AudioNode | null {
    switch (effect.type) {
      case 'reverb':
        return this.createReverb(effect.params);
      case 'delay':
        return this.createDelay(effect.params);
      case 'distortion':
        return this.createDistortion(effect.params);
      case 'filter':
        return this.createFilter(effect.params);
      case 'compressor':
        return this.createCompressor(effect.params);
      default:
        return null;
    }
  }

  private createReverb(params: Record<string, number>): ConvolverNode | null {
    // Simplified reverb using impulse response
    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * params.duration || 2;
    const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, params.decay || 2);
      }
    }
    
    convolver.buffer = impulse;
    return convolver;
  }

  private createDelay(params: Record<string, number>): DelayNode {
    const delay = this.audioContext.createDelay(params.maxDelayTime || 1);
    delay.delayTime.value = params.delayTime || 0.3;
    return delay;
  }

  private createDistortion(params: Record<string, number>): WaveShaperNode {
    const distortion = this.audioContext.createWaveShaper();
    const amount = params.amount || 50;
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    distortion.curve = curve;
    return distortion;
  }

  private createFilter(params: Record<string, number>): BiquadFilterNode {
    const filter = this.audioContext.createBiquadFilter();
    filter.type = (params.type as unknown) as BiquadFilterType || 'lowpass';
    filter.frequency.value = params.frequency || 1000;
    filter.Q.value = params.Q || 1;
    return filter;
  }

  private createCompressor(params: Record<string, number>): DynamicsCompressorNode {
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = params.threshold || -24;
    compressor.knee.value = params.knee || 30;
    compressor.ratio.value = params.ratio || 12;
    compressor.attack.value = params.attack || 0.003;
    compressor.release.value = params.release || 0.25;
    return compressor;
  }

  // Spatial audio positioning
  createSpatialAudio(id: string, position: SpatialAudio): PannerNode {
    const panner = this.audioContext.createPanner();
    
    panner.setPosition(position.x, position.y, position.z);
    panner.refDistance = position.radius;
    panner.coneInnerAngle = position.cone.innerAngle;
    panner.coneOuterAngle = position.cone.outerAngle;
    panner.coneOuterGain = position.cone.outerGain;
    
    // Set panning model for 3D audio
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    
    this.spatialNodes.set(id, panner);
    return panner;
  }

  updateSpatialAudio(id: string, position: Partial<SpatialAudio>) {
    const panner = this.spatialNodes.get(id);
    if (!panner) return;
    
    if (position.x !== undefined) panner.setPosition(position.x, panner.positionY.value, panner.positionZ.value);
    if (position.y !== undefined) panner.setPosition(panner.positionX.value, position.y, panner.positionZ.value);
    if (position.z !== undefined) panner.setPosition(panner.positionX.value, panner.positionY.value, position.z);
  }

  // Dynamic soundtrack system
  playTheme(theme: AudioTheme) {
    if (this.currentTheme) {
      this.stopTheme();
    }
    
    this.currentTheme = theme;
    
    // Start all layers
    for (const layer of theme.layers) {
      const nodes = this.createAudioLayer(layer);
      this.activeLayers.set(layer.id, nodes);
    }
  }

  stopTheme() {
    if (!this.currentTheme) return;
    
    // Fade out and stop all layers
    for (const [layerId, nodes] of this.activeLayers) {
      this.fadeOutLayer(nodes, 1.0);
      setTimeout(() => {
        nodes.forEach(node => {
          if ('stop' in node) {
            (node as OscillatorNode).stop();
          }
          node.disconnect();
        });
      }, 1000);
    }
    
    this.activeLayers.clear();
    this.currentTheme = null;
  }

  private fadeOutLayer(nodes: AudioNode[], duration: number) {
    const gainNode = nodes.find(node => node instanceof GainNode) as GainNode;
    if (gainNode) {
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);
    }
  }

  // Adaptive audio based on gameplay
  adaptAudioToGameplay(gameState: {
    intensity: number;
    ring: number;
    matchPercent: number;
    isPaused: boolean;
  }) {
    if (!this.adaptiveMode || !this.currentTheme) return;
    
    // Adjust audio based on game intensity
    const intensityGain = 0.5 + (gameState.intensity * 0.5);
    this.masterGain.gain.linearRampToValueAtTime(
      intensityGain,
      this.audioContext.currentTime + 0.5
    );
    
    // Add ring-specific audio layers
    this.updateRingAudio(gameState.ring);
    
    // Match percentage affects tempo
    this.updateTempo(gameState.matchPercent);
    
    // Pause/resume audio
    if (gameState.isPaused) {
      this.suspendAudio();
    } else {
      this.resumeAudio();
    }
  }

  private updateRingAudio(ring: number) {
    // Add ring-specific ambient layers
    const ringLayers = {
      1: 'ambient_outer',
      2: 'ambient_middle', 
      3: 'ambient_core',
    };
    
    const layerId = ringLayers[ring as keyof typeof ringLayers];
    if (layerId && this.currentTheme) {
      const layer = this.currentTheme.layers.find(l => l.id === layerId);
      if (layer && !this.activeLayers.has(layerId)) {
        const nodes = this.createAudioLayer(layer);
        this.activeLayers.set(layerId, nodes);
      }
    }
  }

  private updateTempo(matchPercent: number) {
    // Adjust tempo based on match percentage
    const tempoMultiplier = 0.8 + (matchPercent * 0.4); // 0.8x to 1.2x
    
    for (const [layerId, nodes] of this.activeLayers) {
      const oscillator = nodes.find(node => node instanceof OscillatorNode) as OscillatorNode;
      if (oscillator) {
        const baseFreq = oscillator.frequency.value;
        oscillator.frequency.linearRampToValueAtTime(
          baseFreq * tempoMultiplier,
          this.audioContext.currentTime + 0.5
        );
      }
    }
  }

  private suspendAudio() {
    if (this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
  }

  private resumeAudio() {
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Game event sounds
  playGameSound(event: 'skill' | 'hit' | 'levelUp' | 'achievement' | 'death' | 'ringCommit') {
    const soundConfigs = {
      skill: { frequency: 800, duration: 0.2, type: 'square' as OscillatorType },
      hit: { frequency: 200, duration: 0.1, type: 'sawtooth' as OscillatorType },
      levelUp: { frequency: 400, duration: 0.5, type: 'sine' as OscillatorType },
      achievement: { frequency: 600, duration: 0.8, type: 'triangle' as OscillatorType },
      death: { frequency: 100, duration: 1.0, type: 'sawtooth' as OscillatorType },
      ringCommit: { frequency: 1000, duration: 0.3, type: 'sine' as OscillatorType },
    };
    
    const config = soundConfigs[event];
    if (config) {
      this.playProceduralSound(config.frequency, config.duration, config.type);
    }
  }

  private playProceduralSound(frequency: number, duration: number, type: OscillatorType) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  // Audio quality management
  setAudioQuality(quality: 'low' | 'medium' | 'high' | 'ultra') {
    this.audioQuality = quality;
    
    // Adjust processing based on quality
    const sampleRates = {
      low: 22050,
      medium: 44100,
      high: 48000,
      ultra: 96000,
    };
    
    // Note: In a real implementation, you'd recreate the AudioContext
    // with the new sample rate. This is simplified for demonstration.
    console.log(`🎵 Audio quality set to ${quality}`);
  }

  // Audio analysis for reactive visuals
  getAudioAnalysis(): {
    bass: number;
    mid: number;
    treble: number;
    average: number;
  } {
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    const bassEnd = Math.floor(bufferLength * 0.1);
    const midEnd = Math.floor(bufferLength * 0.5);
    
    let bass = 0, mid = 0, treble = 0;
    
    for (let i = 0; i < bassEnd; i++) {
      bass += dataArray[i];
    }
    bass /= bassEnd;
    
    for (let i = bassEnd; i < midEnd; i++) {
      mid += dataArray[i];
    }
    mid /= (midEnd - bassEnd);
    
    for (let i = midEnd; i < bufferLength; i++) {
      treble += dataArray[i];
    }
    treble /= (bufferLength - midEnd);
    
    const average = (bass + mid + treble) / 3;
    
    return { bass, mid, treble, average };
  }

  // Cleanup
  dispose() {
    this.stopTheme();
    this.spatialNodes.clear();
    this.audioContext.close();
  }
}

export const audioExcellence = new AudioExcellence();
