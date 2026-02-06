/**
 * @cjr/client - ParticleEngine
 * High-performance, zero-allocation particle system for "Juice" effects.
 * 
 * Features:
 * - Pre-allocated Object Pool (2000 particles)
 * - Canvas 2D Rendering (optimized)
 * - Behaviors: Gravity, Friction, Fade, Grow/Shrink
 */

export interface ParticleConfig {
    life: number;
    size: number;
    color: string;
    vx: number;
    vy: number;
    damping?: number;
    gravity?: number;
    shrink?: boolean;
    fade?: boolean;
}

interface Particle {
    active: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
    damping: number;
    gravity: number;
    shrink: boolean;
    fade: boolean;
}

export class ParticleEngine {
    private static instance: ParticleEngine;
    private pool: Particle[] = [];
    private poolSize = 2000;
    private activeParticles: Particle[] = []; // Intentionally separate active list for iteration speed? 
    // No, let's use a single array and a pointer or just iterate active count if we swap-remove.
    // Actually, for particles, swap-remove is great.

    private particles: Particle[];
    private activeCount = 0;

    private constructor() {
        this.particles = new Array(this.poolSize);
        for (let i = 0; i < this.poolSize; i++) {
            this.particles[i] = {
                active: false,
                x: 0, y: 0,
                vx: 0, vy: 0,
                life: 0, maxLife: 0,
                size: 0,
                color: '#fff',
                damping: 0.95,
                gravity: 0,
                shrink: true,
                fade: true
            };
        }
    }

    static getInstance(): ParticleEngine {
        if (!ParticleEngine.instance) {
            ParticleEngine.instance = new ParticleEngine();
        }
        return ParticleEngine.instance;
    }

    /**
     * Emit a single particle
     */
    emit(x: number, y: number, config: ParticleConfig): void {
        if (this.activeCount >= this.poolSize) return;

        const p = this.particles[this.activeCount];
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = config.vx;
        p.vy = config.vy;
        p.life = config.life;
        p.maxLife = config.life;
        p.size = config.size;
        p.color = config.color;
        p.damping = config.damping ?? 0.95;
        p.gravity = config.gravity ?? 0;
        p.shrink = config.shrink ?? true;
        p.fade = config.fade ?? true;

        this.activeCount++;
    }

    /**
     * Emit a burst of particles
     */
    emitBurst(x: number, y: number, count: number, color: string, speed: number = 200, size: number = 8): void {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const v = Math.random() * speed;
            this.emit(x, y, {
                life: 0.5 + Math.random() * 0.5,
                size: size * (0.5 + Math.random() * 1.0),
                color: color,
                vx: Math.cos(angle) * v,
                vy: Math.sin(angle) * v,
                damping: 0.92,
            });
        }
    }

    update(dt: number): void {
        for (let i = 0; i < this.activeCount; i++) {
            const p = this.particles[i];
            p.life -= dt;

            if (p.life <= 0) {
                // Deactivate: Swap with last active
                this.activeCount--;
                // Copy last active to current slot
                const last = this.particles[this.activeCount];

                // We must copy all properties to keep the dense array valid
                // In JS, object reference swap is faster, but we pre-allocated objects.
                // Let's swap the OBJECT references in the array.
                this.particles[i] = last;
                this.particles[this.activeCount] = p; // Put dead one at the end

                // Decrement i to re-process this slot (which now holds the swapped particle)
                i--;
                continue;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= p.damping;
            p.vy *= p.damping;
            p.vy += p.gravity * dt;
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        // Optimization: Batch by composite operation?
        ctx.globalCompositeOperation = 'screen'; // Nice for neon glow

        for (let i = 0; i < this.activeCount; i++) {
            const p = this.particles[i];

            const progress = 1 - (p.life / p.maxLife);
            let alpha = 1.0;
            if (p.fade) alpha = 1.0 - progress;

            let size = p.size;
            if (p.shrink) size = p.size * (1.0 - progress);

            if (size <= 0.1 || alpha <= 0.01) continue;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
