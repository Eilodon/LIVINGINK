import { Application, Container, Texture } from 'pixi.js';
import { Emitter, upgradeConfig } from '@pixi/particle-emitter';

// Simple particle config for a "Burst" effect
const burstConfig = {
    lifetime: { min: 0.1, max: 0.5 },
    frequency: 0.001,
    spawnChance: 1,
    particlesPerWave: 10,
    emitterLifetime: 0.1,
    maxParticles: 50,
    pos: { x: 0, y: 0 },
    addAtBack: false,
    behaviors: [
        {
            type: 'alpha',
            config: { alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] } }
        },
        {
            type: 'scale',
            config: { scale: { list: [{ value: 0.5, time: 0 }, { value: 0.1, time: 1 }] } }
        },
        {
            type: 'color',
            config: { color: { list: [{ value: "ffffff", time: 0 }, { value: "ff0000", time: 1 }] } }
        },
        {
            type: 'moveSpeed',
            config: { speed: { list: [{ value: 200, time: 0 }, { value: 50, time: 1 }] } }
        },
        {
            type: 'rotation',
            config: { accel: 0, minSpeed: 0, maxSpeed: 200, minStart: 0, maxStart: 360 }
        }
    ],
};

export class ParticleManager {
    private app: Application;
    private container: Container;
    private emitters: Emitter[] = [];
    private lastTime: number;

    constructor(app: Application, parentContainer: Container) {
        this.app = app;
        this.container = new Container();
        parentContainer.addChild(this.container);
        this.lastTime = Date.now();

        // Register update loop
        app.ticker.add(this.update, this);
    }

    // --- Elemental Effects ---

    spawnSparks(x: number, y: number): void {
        // Metal: Silver/White sparks, fast, short life
        this.spawnEffect(x, y, "E0E0E0", 0.3, 300);
    }

    spawnLeaves(x: number, y: number): void {
        // Wood: Green, floaty, slower
        this.spawnEffect(x, y, "4CAF50", 0.6, 150);
    }

    spawnDroplets(x: number, y: number): void {
        // Water: Blue, fountain-like
        this.spawnEffect(x, y, "2196F3", 0.5, 200);
    }

    spawnEmbers(x: number, y: number): void {
        // Fire: Red/Orange, rising
        this.spawnEffect(x, y, "FF5722", 0.4, 250);
    }

    spawnDust(x: number, y: number): void {
        // Earth: Brown, heavy, spread low
        this.spawnEffect(x, y, "795548", 0.5, 100);
    }

    spawnText(x: number, y: number, text: string, color: string): void {
        // TODO: Floating Text implementation
        console.log(`Float Text: ${text} at ${x},${y}`);
    }

    update(): void {
        const now = Date.now();
        const dt = (now - this.lastTime) * 0.001;
        this.lastTime = now;

        // Update all active emitters
        for (const emitter of this.emitters) {
            emitter.update(dt);
        }
    }

    // Update spawnEffect to allow speed adjustment
    spawnEffect(x: number, y: number, color: string, scale: number = 0.5, speed: number = 200): void {
        const texture = Texture.WHITE; // Use a simple dot for now

        // Deep copy config and modify color
        const config = JSON.parse(JSON.stringify(burstConfig));

        // Find behaviors
        const colorBehavior = config.behaviors.find((b: any) => b.type === 'color');
        if (colorBehavior) {
            colorBehavior.config.color.list[0].value = color.replace('#', '');
            colorBehavior.config.color.list[1].value = color.replace('#', '');
        }

        const scaleBehavior = config.behaviors.find((b: any) => b.type === 'scale');
        if (scaleBehavior) {
            scaleBehavior.config.scale.list[0].value = scale;
            scaleBehavior.config.scale.list[1].value = scale * 0.2;
        }

        const speedBehavior = config.behaviors.find((b: any) => b.type === 'moveSpeed');
        if (speedBehavior) {
            speedBehavior.config.speed.list[0].value = speed;
        }

        const emitter = new Emitter(this.container as any, upgradeConfig(config, [texture]));
        emitter.updateOwnerPos(x, y);
        emitter.playOnceAndDestroy(() => {
            // Cleanup callback
            this.emitters = this.emitters.filter(e => e !== emitter);
        });

        // Add to tracking
        this.emitters.push(emitter);
    }

    // Cleanup
    destroy(): void {
        this.app.ticker.remove(this.update, this);
        this.emitters.forEach(e => e.destroy());
        this.emitters = [];
        this.container.destroy();
    }
}
