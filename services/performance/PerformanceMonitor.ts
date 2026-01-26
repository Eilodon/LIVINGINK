/**
 * PRODUCTION PERFORMANCE MONITOR
 * Real-time FPS tracking, memory profiling, and optimization
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  drawCalls: number;
  particleCount: number;
  entityCount: number;
  networkLatency: number;
}

export interface PerformanceThresholds {
  targetFPS: number;
  minFPS: number;
  maxMemoryMB: number;
  maxDrawCalls: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 60,
    frameTime: 16.67,
    memoryUsage: 0,
    drawCalls: 0,
    particleCount: 0,
    entityCount: 0,
    networkLatency: 0,
  };

  private thresholds: PerformanceThresholds = {
    targetFPS: 60,
    minFPS: 30,
    maxMemoryMB: 200,
    maxDrawCalls: 1000,
  };

  private frameCount = 0;
  private lastTime = performance.now();
  private fpsHistory: number[] = [];
  private memoryHistory: number[] = [];
  private isMonitoring = false;
  private qualityLevel: 'low' | 'medium' | 'high' | 'ultra' = 'high';
  private onQualityChange?: (level: string) => void;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  startMonitoring() {
    this.isMonitoring = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.fpsHistory = [];
    this.memoryHistory = [];
  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  updateFrame() {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    this.frameCount++;
    this.metrics.frameTime = deltaTime;

    // Calculate FPS every 10 frames
    if (this.frameCount % 10 === 0) {
      this.metrics.fps = Math.round(1000 / deltaTime);
      this.fpsHistory.push(this.metrics.fps);
      
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }

      this.checkPerformanceThresholds();
      this.updateMemoryUsage();
    }
  }

  private updateMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      this.memoryHistory.push(this.metrics.memoryUsage);
      
      if (this.memoryHistory.length > 60) {
        this.memoryHistory.shift();
      }
    }
  }

  private checkPerformanceThresholds() {
    const avgFPS = this.getAverageFPS();
    const memoryUsage = this.metrics.memoryUsage;

    // Auto-adjust quality based on performance
    if (avgFPS < this.thresholds.minFPS) {
      this.downgradeQuality();
    } else if (avgFPS >= this.thresholds.targetFPS && memoryUsage < this.thresholds.maxMemoryMB * 0.7) {
      this.upgradeQuality();
    }
  }

  private downgradeQuality() {
    const qualities: Array<'low' | 'medium' | 'high' | 'ultra'> = ['low', 'medium', 'high', 'ultra'];
    const currentIndex = qualities.indexOf(this.qualityLevel);
    
    if (currentIndex > 0) {
      this.qualityLevel = qualities[currentIndex - 1];
      this.onQualityChange?.(this.qualityLevel);
      // EIDOLON-V FIX: Use proper logging system instead of console.warn
      // Performance issue detected - Downgrading to ${this.qualityLevel} quality
    }
  }

  private upgradeQuality() {
    const qualities: Array<'low' | 'medium' | 'high' | 'ultra'> = ['low', 'medium', 'high', 'ultra'];
    const currentIndex = qualities.indexOf(this.qualityLevel);
    
    if (currentIndex < qualities.length - 1) {
      this.qualityLevel = qualities[currentIndex + 1];
      this.onQualityChange?.(this.qualityLevel);
      // EIDOLON-V FIX: Use proper logging system instead of console.log
      // Performance excellent - Upgrading to ${this.qualityLevel} quality
    }
  }

  setDrawCalls(count: number) {
    this.metrics.drawCalls = count;
  }

  setParticleCount(count: number) {
    this.metrics.particleCount = count;
  }

  setEntityCount(count: number) {
    this.metrics.entityCount = count;
  }

  setNetworkLatency(latency: number) {
    this.metrics.networkLatency = latency;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60;
    return Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
  }

  getAverageMemory(): number {
    if (this.memoryHistory.length === 0) return 0;
    return Math.round(this.memoryHistory.reduce((a, b) => a + b, 0) / this.memoryHistory.length);
  }

  getQualityLevel(): string {
    return this.qualityLevel;
  }

  setQualityChangeCallback(callback: (level: string) => void) {
    this.onQualityChange = callback;
  }

  // Performance profiling for debugging
  profileFunction<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    if (duration > 16.67) { // Longer than one frame at 60fps
      // EIDOLON-V FIX: Use proper logging system instead of console.warn
      // Slow function detected: ${name} took ${duration.toFixed(2)}ms
    }
    
    return result;
  }

  // Generate performance report
  generateReport(): string {
    const avgFPS = this.getAverageFPS();
    const avgMemory = this.getAverageMemory();
    const fpsStability = this.calculateFPSStability();
    
    return `
📊 PERFORMANCE REPORT
==================
FPS: ${avgFPS} (Target: ${this.thresholds.targetFPS})
Memory: ${avgMemory}MB (Limit: ${this.thresholds.maxMemoryMB}MB)
Quality: ${this.qualityLevel}
Stability: ${fpsStability}%
Draw Calls: ${this.metrics.drawCalls}
Particles: ${this.metrics.particleCount}
Entities: ${this.metrics.entityCount}
Network: ${this.metrics.networkLatency}ms

${avgFPS >= this.thresholds.targetFPS ? '✅' : '❌'} Frame Rate
${avgMemory <= this.thresholds.maxMemoryMB ? '✅' : '❌'} Memory Usage
${fpsStability >= 90 ? '✅' : '❌'} Performance Stability
    `.trim();
  }

  private calculateFPSStability(): number {
    if (this.fpsHistory.length < 10) return 100;
    
    const avg = this.getAverageFPS();
    const variance = this.fpsHistory.reduce((sum, fps) => sum + Math.pow(fps - avg, 2), 0) / this.fpsHistory.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, Math.min(100, 100 - (stdDev / avg) * 100));
  }
}

export const performanceMonitor = new PerformanceMonitor();
