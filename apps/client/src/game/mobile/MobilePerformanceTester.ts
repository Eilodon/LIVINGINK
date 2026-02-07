/**
 * MOBILE PERFORMANCE TESTING FRAMEWORK
 * Real device performance validation and optimization
 */

export interface DeviceProfile {
  name: string;
  gpu: string;
  cpu: string;
  memory: number;
  screenResolution: { width: number; height: number };
  pixelRatio: number;
  performanceTier: 'low' | 'medium' | 'high' | 'ultra';
  expectedFPS: number;
  maxParticles: number;
  shaderSupport: 'none' | 'basic' | 'advanced';
}

export interface PerformanceTestResult {
  deviceProfile: DeviceProfile;
  actualFPS: number;
  frameTime: number;
  memoryUsage: number;
  particleCount: number;
  shaderPerformance: number;
  batteryImpact: 'low' | 'medium' | 'high';
  recommendations: string[];
  passed: boolean;
}

export interface BenchmarkSuite {
  name: string;
  description: string;
  test: () => Promise<number>;
  weight: number;
}

export class MobilePerformanceTester {
  private static readonly DEVICE_PROFILES: DeviceProfile[] = [
    {
      name: 'iPhone 13 Pro',
      gpu: 'Apple A15 GPU',
      cpu: 'Apple A15 Bionic',
      memory: 6144,
      screenResolution: { width: 1170, height: 2532 },
      pixelRatio: 3,
      performanceTier: 'high',
      expectedFPS: 60,
      maxParticles: 500,
      shaderSupport: 'advanced',
    },
    {
      name: 'Samsung Galaxy S22',
      gpu: 'Adreno 730',
      cpu: 'Snapdragon 8 Gen 1',
      memory: 8192,
      screenResolution: { width: 1080, height: 2400 },
      pixelRatio: 2.75,
      performanceTier: 'high',
      expectedFPS: 60,
      maxParticles: 400,
      shaderSupport: 'advanced',
    },
    {
      name: 'iPhone 11',
      gpu: 'Apple A13 GPU',
      cpu: 'Apple A13 Bionic',
      memory: 4096,
      screenResolution: { width: 828, height: 1792 },
      pixelRatio: 2,
      performanceTier: 'medium',
      expectedFPS: 60,
      maxParticles: 300,
      shaderSupport: 'basic',
    },
    {
      name: 'Google Pixel 6a',
      gpu: 'Mali-G78 MP20',
      cpu: 'Google Tensor',
      memory: 6144,
      screenResolution: { width: 1080, height: 2400 },
      pixelRatio: 2.625,
      performanceTier: 'medium',
      expectedFPS: 60,
      maxParticles: 250,
      shaderSupport: 'basic',
    },
    {
      name: 'Android Budget Device',
      gpu: 'Adreno 610',
      cpu: 'Snapdragon 665',
      memory: 4096,
      screenResolution: { width: 720, height: 1600 },
      pixelRatio: 2,
      performanceTier: 'low',
      expectedFPS: 30,
      maxParticles: 100,
      shaderSupport: 'none',
    },
  ];

  private static readonly BENCHMARK_SUITES: BenchmarkSuite[] = [
    {
      name: 'Canvas Fill Rate',
      description: 'Tests basic canvas rendering performance',
      test: () => MobilePerformanceTester.testCanvasFillRate(),
      weight: 0.2,
    },
    {
      name: 'Particle System',
      description: 'Tests particle rendering performance',
      test: () => MobilePerformanceTester.testParticleSystem(),
      weight: 0.3,
    },
    {
      name: 'Shader Performance',
      description: 'Tests WebGL shader performance',
      test: () => MobilePerformanceTester.testShaderPerformance(),
      weight: 0.3,
    },
    {
      name: 'Memory Allocation',
      description: 'Tests memory allocation and garbage collection',
      test: () => MobilePerformanceTester.testMemoryAllocation(),
      weight: 0.1,
    },
    {
      name: 'Battery Impact',
      description: 'Tests battery consumption impact',
      test: () => MobilePerformanceTester.testBatteryImpact() as Promise<number>,
      weight: 0.1,
    },
  ];

  /**
   * Detect current device profile
   */
  static detectDeviceProfile(): DeviceProfile {
    const userAgent = navigator.userAgent;
    const screen = window.screen;
    const memory = (navigator as any).deviceMemory || 4; // GB

    // Simple device detection
    if (userAgent.includes('iPhone')) {
      if (
        userAgent.includes('iPhone13') ||
        userAgent.includes('iPhone14') ||
        userAgent.includes('iPhone15')
      ) {
        return this.DEVICE_PROFILES[0]; // iPhone 13 Pro
      }
      return this.DEVICE_PROFILES[2]; // iPhone 11
    }

    if (userAgent.includes('Samsung')) {
      if (userAgent.includes('S22') || userAgent.includes('S23') || userAgent.includes('S24')) {
        return this.DEVICE_PROFILES[1]; // Samsung Galaxy S22
      }
    }

    if (userAgent.includes('Pixel')) {
      return this.DEVICE_PROFILES[3]; // Google Pixel 6a
    }

    // Default to budget device for unknown devices
    return this.DEVICE_PROFILES[4];
  }

  /**
   * Run comprehensive performance test
   */
  static async runPerformanceTest(): Promise<PerformanceTestResult> {
    const deviceProfile = this.detectDeviceProfile();
    const results: number[] = [];

    console.log(`🧪 Running performance test for ${deviceProfile.name}...`);

    // Run all benchmarks
    for (const benchmark of this.BENCHMARK_SUITES) {
      try {
        console.log(`📊 Running ${benchmark.name}...`);
        const score = await benchmark.test();
        results.push(score);
        console.log(`✅ ${benchmark.name}: ${score.toFixed(2)}`);
      } catch (error) {
        console.error(`❌ ${benchmark.name} failed:`, error);
        results.push(0);
      }
    }

    // Calculate weighted score
    const weightedScore = results.reduce((sum, score, index) => {
      return sum + score * this.BENCHMARK_SUITES[index].weight;
    }, 0);

    // Generate recommendations
    const recommendations = this.generateRecommendations(deviceProfile, weightedScore);

    // Determine if test passed
    const passed = weightedScore >= 0.7; // 70% threshold

    return {
      deviceProfile,
      actualFPS: await this.measureActualFPS(),
      frameTime: await this.measureFrameTime(),
      memoryUsage: this.getMemoryUsage(),
      particleCount: this.getMaxParticleCount(),
      shaderPerformance: results[2] || 0, // Shader benchmark
      batteryImpact: this.getBatteryImpactLevel(await this.testBatteryImpact()),
      recommendations,
      passed,
    };
  }

  /**
   * Test canvas fill rate
   */
  private static async testCanvasFillRate(): Promise<number> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    canvas.width = 800;
    canvas.height = 600;

    const startTime = performance.now();
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      ctx.fillStyle = `hsl(${(i * 360) / iterations}, 70%, 50%)`;
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 50, 50);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Score based on iterations per second
    return Math.min(1.0, (iterations / duration) * 10);
  }

  /**
   * Test particle system performance
   */
  private static async testParticleSystem(): Promise<number> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    canvas.width = 800;
    canvas.height = 600;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
    }> = [];
    const particleCount = 200;

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 5 + 2,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      });
    }

    const startTime = performance.now();
    const frames = 60;

    for (let frame = 0; frame < frames; frame++) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off walls
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Score based on frames per second
    return Math.min(1.0, (frames / duration) * 16.67); // 60fps = 1.0
  }

  /**
   * Test shader performance
   */
  private static async testShaderPerformance(): Promise<number> {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
      console.warn('WebGL not supported');
      return 0;
    }

    const webglGL = gl as WebGLRenderingContext;

    // Simple shader test
    const vertexShader = webglGL.createShader(webglGL.VERTEX_SHADER);
    if (!vertexShader) return 0;

    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    webglGL.shaderSource(vertexShader, vertexShaderSource);
    webglGL.compileShader(vertexShader);

    const fragmentShader = webglGL.createShader(webglGL.FRAGMENT_SHADER);
    if (!fragmentShader) return 0;

    const fragmentShaderSource = `
      precision mediump float;
      uniform float u_time;
      void main() {
        gl_FragColor = vec4(sin(u_time), cos(u_time), 0.5, 1.0);
      }
    `;

    webglGL.shaderSource(fragmentShader, fragmentShaderSource);
    webglGL.compileShader(fragmentShader);

    const program = webglGL.createProgram();
    if (!program) return 0;

    webglGL.attachShader(program, vertexShader);
    webglGL.attachShader(program, fragmentShader);
    webglGL.linkProgram(program);

    const startTime = performance.now();

    // Render test
    for (let i = 0; i < 1000; i++) {
      webglGL.useProgram(program);
      webglGL.drawArrays(webglGL.TRIANGLES, 0, 3);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    return Math.min(1.0, (1000 / duration) * 0.01);
  }

  /**
   * Test memory allocation
   */
  private static async testMemoryAllocation(): Promise<number> {
    const startTime = performance.now();
    const objects: any[] = [];

    // Allocate and deallocate memory
    for (let i = 0; i < 10000; i++) {
      objects.push({
        id: i,
        data: new Array(100).fill(0).map(() => Math.random()),
        timestamp: Date.now(),
      });
    }

    // Clear some objects
    objects.splice(0, 5000);

    // Force garbage collection if available
    if ((window as any).gc) {
      (window as any).gc();
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    return Math.min(1.0, (10000 / duration) * 0.001);
  }

  /**
   * Test battery impact
   */
  private static async testBatteryImpact(): Promise<number> {
    // Simple battery test based on performance
    const fps = await this.measureActualFPS();
    const memory = this.getMemoryUsage();

    // Estimate battery impact based on performance metrics
    const impact = (60 - fps) / 60 + memory / 100;

    return Math.max(0, 1 - impact);
  }

  /**
   * Convert battery impact score to level
   */
  private static getBatteryImpactLevel(score: number): 'low' | 'medium' | 'high' {
    if (score > 0.7) return 'low';
    if (score > 0.4) return 'medium';
    return 'high';
  }

  /**
   * Measure actual FPS
   */
  private static async measureActualFPS(): Promise<number> {
    return new Promise(resolve => {
      let frames = 0;
      const startTime = performance.now();

      const measureFrame = () => {
        frames++;

        if (performance.now() - startTime >= 1000) {
          resolve(frames);
          return;
        }

        requestAnimationFrame(measureFrame);
      };

      requestAnimationFrame(measureFrame);
    });
  }

  /**
   * Measure frame time
   */
  private static async measureFrameTime(): Promise<number> {
    const frameTimes: number[] = [];

    return new Promise(resolve => {
      let lastTime = performance.now();

      const measureFrame = () => {
        const currentTime = performance.now();
        const frameTime = currentTime - lastTime;
        frameTimes.push(frameTime);
        lastTime = currentTime;

        if (frameTimes.length >= 60) {
          const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
          resolve(avgFrameTime);
          return;
        }

        requestAnimationFrame(measureFrame);
      };

      requestAnimationFrame(measureFrame);
    });
  }

  /**
   * Get memory usage
   */
  private static getMemoryUsage(): number {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      return (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    }

    return 0; // Memory API not available
  }

  /**
   * Get max particle count for device
   */
  private static getMaxParticleCount(): number {
    const profile = this.detectDeviceProfile();
    return profile.maxParticles;
  }

  /**
   * Generate performance recommendations
   */
  private static generateRecommendations(profile: DeviceProfile, score: number): string[] {
    const recommendations: string[] = [];

    if (score < 0.3) {
      recommendations.push('Consider using low-end device settings');
      recommendations.push('Disable particle effects');
      recommendations.push('Use basic rendering mode');
    } else if (score < 0.6) {
      recommendations.push('Reduce particle count');
      recommendations.push('Disable advanced shaders');
      recommendations.push('Lower rendering quality');
    } else if (score < 0.8) {
      recommendations.push('Monitor performance during gameplay');
      recommendations.push('Consider medium quality settings');
    }

    if (profile.performanceTier === 'low') {
      recommendations.push('Enable battery saver mode');
      recommendations.push('Reduce visual effects');
    }

    if (profile.shaderSupport === 'none') {
      recommendations.push('Use fallback rendering without shaders');
    }

    return recommendations;
  }

  /**
   * Get performance report
   */
  static async getPerformanceReport(): Promise<{
    deviceProfile: DeviceProfile;
    testResult: PerformanceTestResult;
    optimizationSettings: {
      quality: 'low' | 'medium' | 'high' | 'ultra';
      maxParticles: number;
      shaderEnabled: boolean;
      effectsEnabled: boolean;
    };
  }> {
    const deviceProfile = this.detectDeviceProfile();
    const testResult = await this.runPerformanceTest();

    // Generate optimization settings
    let quality: 'low' | 'medium' | 'high' | 'ultra' = 'medium';
    let maxParticles = deviceProfile.maxParticles;
    let shaderEnabled = deviceProfile.shaderSupport !== 'none';
    let effectsEnabled = testResult.actualFPS >= 30;

    if (testResult.actualFPS < 30) {
      quality = 'low';
      maxParticles = Math.floor(maxParticles * 0.5);
      shaderEnabled = false;
      effectsEnabled = false;
    } else if (testResult.actualFPS < 50) {
      quality = 'medium';
      maxParticles = Math.floor(maxParticles * 0.7);
      shaderEnabled = deviceProfile.shaderSupport === 'advanced';
      effectsEnabled = true;
    } else if (testResult.actualFPS >= 55) {
      quality = 'high';
      if (deviceProfile.performanceTier === 'high') {
        quality = 'ultra';
      }
    }

    return {
      deviceProfile,
      testResult,
      optimizationSettings: {
        quality,
        maxParticles,
        shaderEnabled,
        effectsEnabled,
      },
    };
  }
}

export const mobilePerformanceTester = MobilePerformanceTester;
