/**
 * VITEST TEST SETUP FOR AUTOMATED TESTING
 * Initialize test environment for Vitest
 */

import { beforeAll, afterAll, vi } from 'vitest';

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
      get currentTime() { return 0; }
      get outputTimestamp() { return 0; }
      get sampleRate() { return 48000; }
      get state() { return 'suspended'; }
    },
    configurable: true
  });

  // Mock fetch API
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: 'http://localhost',
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      formData: () => Promise.resolve(new FormData()),
      clone: () => Promise.resolve({}),
      body: null,
      bodyUsed: false,
      bytes: () => Promise.resolve(new Uint8Array())
    })
  );

  // Mock performance API
  global.performance = {
    now: vi.fn(() => performance.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    clearResourceTimings: vi.fn(),
    setResourceTimingBufferSize: vi.fn(),
    toJSON: vi.fn(() => ({})),
    eventCounts: new Map(),
    navigation: {
      redirectCount: 0,
      type: 'navigate',
      toJSON: () => ({})
    },
    onresourcetimingbufferfull: null,
    timeOrigin: 0
  };

  // Mock WebSocket
  global.WebSocket = vi.fn(() => ({
    close: vi.fn(() => Promise.resolve()),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.CONNECTING,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  }));

  // Mock localStorage
  const localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
    configurable: true
  });

  // Mock matchMedia
  global.matchMedia = vi.fn(() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));

  // Mock performance.memory
  Object.defineProperty(global.performance, 'memory', {
    value: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 10000,
      jsHeapSizeLimit: 50000
    },
    configurable: true
  });

  console.log('✅ Vitest test environment setup complete');
});

// Cleanup after tests
afterAll(() => {
  document.body.innerHTML = '';
  console.log('✅ Vitest test environment cleaned up');
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
  simulateWait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  simulateKeyPress: (key: string) => {
    const event = new KeyboardEvent('keydown', { key });
    document.dispatchEvent(event);
  },
  simulateTouch: (element: HTMLElement) => {
    const touch = new TouchEvent('touch', {
      bubbles: true,
      cancelable: true,
      target: element
    });
    element.dispatchEvent(touch);
  }
};

export default testUtils;
