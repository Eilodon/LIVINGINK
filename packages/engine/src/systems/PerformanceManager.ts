export enum PerformanceTier {
    GOD = 0,    // Uncapped, Max Visuals
    HIGH = 1,   // 60 FPS Target
    MID = 2,    // 30-60 Dynamic, Reduced Particles
    LOW = 3     // 30 FPS Cap, Minimal VFX
}

export interface PerformanceMetrics {
    fps: number;
    avgFrameTime: number;
    droppedFrames: number;
    tier: PerformanceTier;
}

export class PerformanceManager {
    static instance: PerformanceManager;

    public currentTier: PerformanceTier = PerformanceTier.HIGH;

    // Metrics
    private lastTime: number = 0;
    private frameCount: number = 0;
    private accumulatedTime: number = 0;
    private fps: number = 60;
    private frameTimes: number[] = [];
    private droppedFrames: number = 0;

    // Throttling
    private framesBelowTarget: number = 0;
    private framesAboveTarget: number = 0;

    private constructor() {
        this.lastTime = performance.now();
        this.detectDeviceTier();
    }

    private detectDeviceTier() {
        try {
            // 1. Hardware Concurrency & Memory
            const cores = navigator.hardwareConcurrency || 4;
            const memory = (navigator as any).deviceMemory || 4;

            // 2. GPU Detection
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            let renderer = '';

            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                }
            }

            console.log(`[PerformanceManager] Hardware: ${cores} Cores, ~${memory}GB RAM, GPU: ${renderer}`);

            // 3. Heuristics
            let score = 0;

            // CPU Score
            if (cores >= 12) score += 3;
            else if (cores >= 8) score += 2;
            else if (cores >= 4) score += 1;

            // GPU Score
            const lowerRenderer = renderer.toLowerCase();

            // Tier GOD (RTX 30/40+, M2/M3 Max/Pro)
            if (/rtx (30|40|50)|radeon rx [6-9]\d00|m3 max|m3 pro|m2 max/.test(lowerRenderer)) {
                score += 10;
            }
            // Tier HIGH (GTX 16/20/10, M1/M2/M3 Base)
            else if (/gtx|rtx|radeon|apple gpu/.test(lowerRenderer)) {
                score += 5;
            }
            // Tier MID (Intel Iris, Adreno High)
            else if (/iris|adreno (66|7|8)|mali-g7/.test(lowerRenderer)) {
                score += 2;
            }
            // Tier LOW (Intel UHD, Old Mobile)
            else {
                score += 0;
            }

            // Mobile penalty
            const isMobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
            if (isMobile) score -= 2;

            // Final Tier Mapping
            if (score >= 12) this.currentTier = PerformanceTier.GOD;
            else if (score >= 5) this.currentTier = PerformanceTier.HIGH;
            else if (score >= 2) this.currentTier = PerformanceTier.MID;
            else this.currentTier = PerformanceTier.LOW;

            console.log(`[PerformanceManager] Initial Tier Detected: ${PerformanceTier[this.currentTier]} (Score: ${score})`);

        } catch (e) {
            console.warn('[PerformanceManager] detection failed, defaulting to HIGH', e);
            this.currentTier = PerformanceTier.HIGH;
        }
    }

    static getInstance(): PerformanceManager {
        if (!PerformanceManager.instance) {
            PerformanceManager.instance = new PerformanceManager();
        }
        return PerformanceManager.instance;
    }

    /**
     * Call this every frame (e.g. at start of RAF loop)
     * Returns true if frame should be processed, false if skipped (for throttling)
     */
    update(timestamp: number): boolean {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.frameCount++;
        this.accumulatedTime += dt;
        this.frameTimes.push(dt);
        if (this.frameTimes.length > 60) this.frameTimes.shift();

        // Update FPS every second
        if (this.accumulatedTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.accumulatedTime -= 1000;
            this.evaluateTier();
            this.checkMemoryBudget();
        }

        // Variable Rate Throttling
        if (this.currentTier === PerformanceTier.LOW) {
            // Simple skip every other frame logic could go here, 
            // but usually we rely on game loop to handle fixed step.
            // For now, we mainly use Tier to control VFX count.
        }

        return true;
    }

    private checkMemoryBudget() {
        // Memory Budget (Chrome Only)
        // @ts-ignore
        if (performance.memory) {
            // @ts-ignore
            const mem = performance.memory;
            // If usedJSHeapSize > 90% of jsHeapSizeLimit, panic mode
            if (mem.usedJSHeapSize > mem.jsHeapSizeLimit * 0.9) {
                console.warn(`[PerformanceManager] CRITICAL MEMORY USAGE detected! Force Downgrade.`);
                this.currentTier = PerformanceTier.LOW;
            }
        }
    }

    private evaluateTier() {
        // Simple Hysteresis
        const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

        if (this.fps < 50) {
            this.framesBelowTarget++;
            this.framesAboveTarget = 0;
        } else if (this.fps >= 58) {
            this.framesAboveTarget++;
            this.framesBelowTarget = 0;
        }

        // Downgrade
        if (this.framesBelowTarget > 3 && this.currentTier < PerformanceTier.LOW) {
            this.currentTier++;
            this.framesBelowTarget = 0;
            console.warn(`[PerformanceManager] FPS Drop detected (${this.fps}). Downgrading to Tier ${PerformanceTier[this.currentTier]}`);
        }

        // Upgrade (Be conservative)
        if (this.framesAboveTarget > 10 && this.currentTier > PerformanceTier.HIGH) {
            this.currentTier--;
            this.framesAboveTarget = 0;
            console.log(`[PerformanceManager] Performance stable. Upgrading to Tier ${PerformanceTier[this.currentTier]}`);
        }
    }

    getMetrics(): PerformanceMetrics {
        return {
            fps: this.fps,
            avgFrameTime: this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length || 0,
            droppedFrames: this.droppedFrames, // TODO: Implement proper dropped frame logic vs target
            tier: this.currentTier
        };
    }

    shouldRenderValues(): boolean {
        // Example helper for components
        return this.currentTier <= PerformanceTier.HIGH;
    }
}
