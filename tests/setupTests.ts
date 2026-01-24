/**
 * TEST SETUP FOR AUTOMATED TESTING
 * Initialize test environment
 */

import { expect, beforeAll, afterAll, describe, jest } from '@jest/globals';

// Setup test environment
beforeAll(() => {
  // Set up DOM environment
  document.body.innerHTML = `
    <div id="test-container">
      <canvas id="test-canvas"></canvas>
      <div id="test-button">Test Button</div>
    </div>
  `;
  
  // Setup canvas for visual tests
  const canvas = document.getElementById('test-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 100, 100);
  }
  
  // Setup mock AudioContext
  Object.defineProperty(window, 'AudioContext', {
    value: class MockAudioContext {
      createGainNode() { return {} as GainNode; }
      createOscillator() { return {} as OscillatorNode; }
      createAnalyser() { return {} as AnalyserNode; }
      createBiquadFilter() { return {} as BiquadFilterNode; }
      createChannelMerger() { return {} as ChannelMergerNode; }
      createDelayNode() { return {} as DelayNode; }
      createConvolver() { return {} as ConvolverNode; }
      createScriptProcessor() { return {} as ScriptProcessor; }
      createWaveShaper() { return {} as WaveShaperNode; }
      createPanner() { return {} as PannerNode; }
      createPeriodicWave() { return {} as PeriodicWaveShaperNode; }
      createStereoPanner() { return {} as StereoPannerNode; }
      createAnalyser() { return {} as AnalyserNode; }
      createDynamicCompressor() { return {} as DynamicCompressorNode; }
      createDelayNode() { return {} as DelayNode; }
      createConvolver() { return {} as ConvolverNode; }
      createScriptProcessor() { return {} as ScriptProcessor; }
      createWaveShaper() { return {} as WaveShaperNode; }
      createPanner() { return {} as PannerNode; }
      createPeriodicWave() { return {} as PeriodicWaveShaperNode; }
      createStereoPanner() { return {} as StereoPannerNode; }
      createAnalyser() { return {} as AnalyserNode; }
      createDynamicCompressor() { return {} as DynamicCompressorNode; }
      close() { return Promise.resolve(); }
      resume() { return Promise.resolve(); }
      suspend() { return Promise.resolve(); }
      createMediaStream() { return {} as MediaStream; }
      get currentTime() { return 0; }
      get outputTimestamp() { return 0; }
      get sampleRate() { return 48000; }
      get state() { return 'suspended'; }
    },
    configurable: true
  });

  // Mock fetch API
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      formData: () => Promise.resolve(new FormData())
    }
  ));

  // Mock performance API
  global.performance = {
    now: jest.fn(() => performance.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    clearResourceTimings: jest.fn(),
    setResourceTimingBufferSize: jest.fn(),
    getTotalMemoryUsage: jest.fn(() => ({
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 10000,
      jsHeapSizeLimit: 50000
    })),
  };

  // Mock WebSocket
  global.WebSocket = jest.fn(() => ({
    close: jest.fn(() => Promise.resolve()),
    send: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: WebSocket.CONNECTING,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  }));

  // Mock localStorage
  const localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
    clear: jest.fn(),
    key: jest.fn()
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
    configurable: true
  });

  // Mock matchMedia
  global.matchMedia = jest.fn(() => ({
    matches: false,
    media: '',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    matches: jest.fn(() => ({ matches: false, media: '' }))
  }));

  console.log('✅ Test environment setup complete');
});

// Cleanup after tests
afterAll(() => {
  document.body.innerHTML = '';
  console.log('✅ Test environment cleaned up');
});

// Export test utilities
export const testUtils = {
  createMockCanvas: () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
  },
  createMockAudioContext: () => new (window.AudioContext || (window as any).webkitAudioContext)(),
  createMockWebSocket: () => new WebSocket('ws://localhost:8080'),
  createMockLocalStorage: () => localStorage,
  simulateClick: (element: HTMLElement) => element.click(),
  waitFor: (condition: () => boolean) => new Promise(resolve => {
    const check = () => {
      if (condition()) {
        resolve(true);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  }),
  simulateWait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  simulateKeyPress: (key: string) => {
    const event = new KeyboardEvent('keydown', { key });
    document.dispatchEvent(event);
  }
};

export default testUtils;
