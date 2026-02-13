import { Application, Container, Texture, ParticleContainer } from 'pixi.js';
import { Emitter, upgradeConfig } from '@pixi/particle-emitter';

// --- ELEMENTAL CONFIGURATIONS ---

const baseConfig = {
    lifetime: { min: 0.5, max: 0.8 },
    frequency: 0.001,
    spawnChance: 1,
    particlesPerWave: 8,
    emitterLifetime: 0.15,
    maxParticles: 50,
    pos: { x: 0, y: 0 },
    addAtBack: false,
    behaviors: [
        { type: 'alpha', config: { alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] } } },
        { type: 'scale', config: { scale: { list: [{ value: 0.8, time: 0 }, { value: 0.1, time: 1 }] } } },
        { type: 'color', config: { color: { list: [{ value: "ffffff", time: 0 }, { value: "ffffff", time: 1 }] } } },
        { type: 'rotation', config: { accel: 0, minSpeed: 0, maxSpeed: 100, minStart: 0, maxStart: 360 } },
        { type: 'moveSpeed', config: { speed: { list: [{ value: 150, time: 0 }, { value: 50, time: 1 }] } } }
    ],
};

// 1. METAL: Sharp sparks, high speed, short life (Explosive)
const metalConfig = JSON.parse(JSON.stringify(baseConfig));
metalConfig.behaviors.find((b: any) => b.type === 'color').config.color.list = [{ value: "E0E0E0", time: 0 }, { value: "FFFFFF", time: 1 }];
metalConfig.behaviors.find((b: any) => b.type === 'moveSpeed').config.speed.list = [{ value: 300, time: 0 }, { value: 0, time: 1 }];
metalConfig.lifetime = { min: 0.2, max: 0.4 };
metalConfig.particlesPerWave = 12;

// 2. WOOD: Leaves/Petals, drifting, spinning, slower (Gentle)
const woodConfig = JSON.parse(JSON.stringify(baseConfig));
woodConfig.behaviors.find((b: any) => b.type === 'color').config.color.list = [{ value: "4CAF50", time: 0 }, { value: "81C784", time: 1 }];
woodConfig.behaviors.find((b: any) => b.type === 'moveSpeed').config.speed.list = [{ value: 100, time: 0 }, { value: 20, time: 1 }];
woodConfig.behaviors.find((b: any) => b.type === 'rotation').config.minSpeed = 50; // Spin more
woodConfig.lifetime = { min: 0.8, max: 1.2 };

// 3. WATER: Droplets, affected by gravity (Splash)
const waterConfig = JSON.parse(JSON.stringify(baseConfig));
waterConfig.behaviors.find((b: any) => b.type === 'color').config.color.list = [{ value: "2196F3", time: 0 }, { value: "BBDEFB", time: 1 }];
waterConfig.behaviors.push({ // Add Gravity
    type: 'moveAcceleration',
    config: { accel: { x: 0, y: 500 }, minStart: 0, maxStart: 0, rotate: true }
});
waterConfig.behaviors.find((b: any) => b.type === 'moveSpeed').config.speed.list = [{ value: 200, time: 0 }, { value: 200, time: 1 }];

// 4. FIRE: Rising embers, turbulence (Energy)
const fireConfig = JSON.parse(JSON.stringify(baseConfig));
fireConfig.behaviors.find((b: any) => b.type === 'color').config.color.list = [{ value: "FF5722", time: 0 }, { value: "FFFF00", time: 1 }];
fireConfig.behaviors.push({ // Rise Up
    type: 'moveAcceleration',
    config: { accel: { x: 0, y: -300 }, minStart: 0, maxStart: 0, rotate: true }
});
fireConfig.lifetime = { min: 0.4, max: 0.7 };

// 5. EARTH: Heavy chunks, low speed, gravity (Impact)
const earthConfig = JSON.parse(JSON.stringify(baseConfig));
earthConfig.behaviors.find((b: any) => b.type === 'color').config.color.list = [{ value: "795548", time: 0 }, { value: "3E2723", time: 1 }];
earthConfig.behaviors.find((b: any) => b.type === 'moveSpeed').config.speed.list = [{ value: 80, time: 0 }, { value: 0, time: 0.5 }];
earthConfig.particlesPerWave = 6;
earthConfig.behaviors.find((b: any) => b.type === 'scale').config.scale.list = [{ value: 1.2, time: 0 }, { value: 0.5, time: 1 }]; // Bigger chunks

export class ParticleManager {
    private app: Application;
    private container: Container;
    private emitters: Emitter[] = [];
    private lastTime: number;

    constructor(app: Application, parentContainer: Container) {
        this.app = app;
        this.container = new Container(); // Standard Container for compatibility
        parentContainer.addChild(this.container);
        this.lastTime = Date.now();

        // Register update loop
        app.ticker.add(this.update, this);
    }

    // --- Elemental Effects ---

    spawnSparks(x: number, y: number): void {
        this.emit(x, y, metalConfig, Texture.WHITE);
    }

    spawnLeaves(x: number, y: number): void {
        this.emit(x, y, woodConfig, Texture.WHITE); // Could use a leaf texture if available
    }

    spawnDroplets(x: number, y: number): void {
        this.emit(x, y, waterConfig, Texture.WHITE);
    }

    spawnEmbers(x: number, y: number): void {
        this.emit(x, y, fireConfig, Texture.WHITE);
    }

    spawnDust(x: number, y: number): void {
        this.emit(x, y, earthConfig, Texture.WHITE);
    }

    spawnText(x: number, y: number, text: string, color: string): void {
        // console.log(`Float Text: ${text} at ${x},${y}`);
        // TODO: Implement valid floating text
    }

    // Add ink stain on match
    spawnInkStain(x: number, y: number, element: number): void {
        // Placeholder for Ink Effect
    }

    // Apply ink effects to grid sprites
    applyInkToSprites(sprites: any[]): void {
        // No-op
    }

    getInkTexture() {
        return Texture.EMPTY;
    }

    update(): void {
        const now = Date.now();
        const dt = (now - this.lastTime) * 0.001;
        this.lastTime = now;

        // Update all active emitters
        for (let i = this.emitters.length - 1; i >= 0; i--) {
            this.emitters[i].update(dt);
        }
    }

    private emit(x: number, y: number, config: any, texture: Texture): void {
        // Create emitter
        const emitter = new Emitter(this.container as any, upgradeConfig(config, [texture]));
        emitter.updateOwnerPos(x, y);
        emitter.playOnceAndDestroy(() => {
            this.emitters = this.emitters.filter(e => e !== emitter);
        });
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
