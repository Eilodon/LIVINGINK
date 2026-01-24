/**
 * GLOBAL AUDIO CONTEXT MOCK
 * Mock AudioContext before any imports
 */

// Mock AudioContext globally before any imports
if (typeof window !== 'undefined') {
  // Mock AudioContext constructor
  const MockAudioContext = class {
    createGainNode() { return {} as GainNode; }
    createOscillator() { return {} as OscillatorNode; }
    createAnalyser() { return {} as AnalyserNode; }
    createBiquadFilter() { return {} as BiquadFilterNode; }
    createChannelMerger() { return {} as ChannelMergerNode; }
    createDelayNode() { return {} as DelayNode; }
    createConvolver() { return {} as ConvolverNode; }
    createScriptProcessorNode() { return {} as ScriptProcessorNode; }
    createWaveShaper() { return {} as WaveShaperNode; }
    createPanner() { return {} as PannerNode; }
    createPeriodicWave() { return {} as PeriodicWave; }
    createStereoPanner() { return {} as StereoPannerNode; }
    createDynamicsCompressor() { return {} as DynamicsCompressorNode; }
    close() { return Promise.resolve(); }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    createMediaStream() { return {} as MediaStream; }
    currentTime: 0
    outputTimestamp: 0
    sampleRate: 48000
    state: 'suspended'
  };

  // Override AudioContext
  Object.defineProperty(window, 'AudioContext', {
    value: MockAudioContext,
    configurable: true,
    writable: true
  });

  // Override webkitAudioContext
  Object.defineProperty(window, 'webkitAudioContext', {
    value: MockAudioContext,
    configurable: true,
    writable: true
  });

  console.log('🎵 Global AudioContext mock applied');
}

// Vitest globalSetup export
export async function setup() {
  console.log('🎵 Global AudioContext setup completed');
}

export async function teardown() {
  console.log('🎵 Global AudioContext teardown completed');
}
