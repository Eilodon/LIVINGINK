/**
 * @cjr/client - JuiceSystem
 * "The Visionary"
 * 
 * Bridges Engine Events -> Visual Effects.
 * Consumes the EventRingBuffer and orchestrates the specific aesthetic response.
 */

import { eventBuffer, EngineEventType, IEngineEvent } from '@cjr/engine';
import { ParticleEngine } from './ParticleEngine';

// Aesthetic Palette
const PALETTE = {
    CYAN: '#00f3ff',
    PINK: '#ff0055',
    GREEN: '#ccff00',
    WHITE: '#ffffff',
    ORANGE: '#ffaa00',
};

export class JuiceSystem {
    private static instance: JuiceSystem;
    private particleEngine: ParticleEngine;

    // Screen Shake State
    private shakeTrauma = 0;
    private maxShakeOffset = 20;
    private shakeDecay = 1.5; // Trauma lost per second
    public shakeOffset = { x: 0, y: 0 };

    private constructor() {
        this.particleEngine = ParticleEngine.getInstance();
    }

    static getInstance(): JuiceSystem {
        if (!JuiceSystem.instance) {
            JuiceSystem.instance = new JuiceSystem();
        }
        return JuiceSystem.instance;
    }

    /**
     * Main update loop called by RenderSystem
     */
    update(dt: number): void {
        // 1. Consumer Engine Events
        this.consumeEvents();

        // 2. Update Particles
        this.particleEngine.update(dt);

        // 3. Update Screen Shake
        this.updateShake(dt);
    }

    /**
     * Render visuals (Particles)
     */
    render(ctx: CanvasRenderingContext2D): void {
        this.particleEngine.render(ctx);
    }

    private consumeEvents() {
        // Zero-allocation drain
        eventBuffer.drain((e: IEngineEvent) => {
            this.handleEvent(e);
        });
    }

    private handleEvent(e: IEngineEvent) {
        switch (e.type) {
            case EngineEventType.PARTICLE_BURST:
                // Data often encodes color in hex (number)
                // Convert number color to hex string if needed, or use palette
                const colorHex = '#' + (e.data & 0xFFFFFF).toString(16).padStart(6, '0');
                this.particleEngine.emitBurst(e.x, e.y, 10, colorHex, 300, 6);
                break;

            case EngineEventType.SHOCKWAVE:
                this.addTrauma(0.5);
                // Shockwave particle effect (ring)
                // We'll simulate a ring with a burst for now, or add specific shockwave particle support later
                this.particleEngine.emitBurst(e.x, e.y, 20, PALETTE.WHITE, 500, 4);
                break;

            case EngineEventType.EXPLODE:
                this.addTrauma(1.0);
                this.particleEngine.emitBurst(e.x, e.y, 50, PALETTE.PINK, 600, 10);
                this.particleEngine.emitBurst(e.x, e.y, 20, PALETTE.ORANGE, 400, 8);
                break;

            case EngineEventType.TATTOO_ACTIVATE:
                this.particleEngine.emitBurst(e.x, e.y, 15, PALETTE.GREEN, 250, 5);
                break;

            case EngineEventType.RING_COMMIT:
                this.addTrauma(0.3);
                this.particleEngine.emitBurst(e.x, e.y, 30, PALETTE.CYAN, 400, 8);
                break;
        }
    }

    // --- Screen Shake Logic ---

    addTrauma(amount: number) {
        this.shakeTrauma = Math.min(1.0, this.shakeTrauma + amount);
    }

    private updateShake(dt: number) {
        if (this.shakeTrauma > 0) {
            this.shakeTrauma = Math.max(0, this.shakeTrauma - this.shakeDecay * dt);

            // Shake = trauma^2 * maxOffset
            const shake = this.shakeTrauma * this.shakeTrauma * this.maxShakeOffset;

            // Perlin noise would be better, but random is okay for now
            const angle = Math.random() * Math.PI * 2;

            this.shakeOffset.x = Math.cos(angle) * shake;
            this.shakeOffset.y = Math.sin(angle) * shake;
        } else {
            this.shakeOffset.x = 0;
            this.shakeOffset.y = 0;
        }
    }
}
