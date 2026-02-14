import { Container, Texture, Sprite, Color } from 'pixi.js';

export interface ParticleData {
    x: number;
    y: number;
    vx: number;
    vy: number;

    life: number;
    maxLife: number;

    scaleStart: number;
    scaleEnd: number;

    alphaStart: number;
    alphaEnd: number;

    rotation: number;
    rotationSpeed: number;

    colorStart: Color;
    colorEnd: Color; // For interpolation

    active: boolean;
    view: Sprite;
}

export interface EmissionConfig {
    count: number;
    color: number | string;
    speed: number;
    scale: number;
    life: number;
    spread: number; // Angle spread in radians
    burst: boolean;
}

export class ParticleSystem {
    private container: Container;
    private particles: ParticleData[] = [];
    private pool: ParticleData[] = [];
    private texture: Texture;

    constructor(parent: Container, texture: Texture) {
        this.container = new Container();
        // this.container.isRenderGroup = true; // Optimization if available in v8
        parent.addChild(this.container);
        this.texture = texture;
    }

    public update(dt: number) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            p.life -= dt;
            if (p.life <= 0) {
                this.returnParticle(i);
                continue;
            }

            // Physics
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 0.5 * dt; // Gravity (customizable?)
            p.rotation += p.rotationSpeed * dt;

            // Interpolation factor (0 to 1)
            const t = 1 - (p.life / p.maxLife);

            // Visual Sync
            p.view.x = p.x;
            p.view.y = p.y;
            p.view.rotation = p.rotation;

            // Lerp Scale
            const currentScale = p.scaleStart + (p.scaleEnd - p.scaleStart) * t;
            p.view.setSize(this.texture.width * currentScale, this.texture.height * currentScale);
            // Or just scale if setSize is not optimal
            // p.view.scale.set(currentScale);

            // Lerp Alpha
            p.view.alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * t;

            // Color interpolation could be expensive, maybe skip for now or pre-tint
            // p.view.tint = p.colorStart; // Simplified
        }
    }

    public burst(x: number, y: number, config: Partial<EmissionConfig>) {
        const count = config.count || 10;
        const baseSpeed = config.speed || 5;
        const color = new Color(config.color || 0xFFFFFF);

        for (let i = 0; i < count; i++) {
            const p = this.getParticle();
            if (!p) return;

            p.x = x;
            p.y = y;

            const angle = Math.random() * Math.PI * 2;
            const speed = baseSpeed * (0.5 + Math.random() * 0.5);

            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;

            p.life = config.life || 1.0;
            p.maxLife = p.life;

            p.scaleStart = config.scale || 1.0;
            p.scaleEnd = 0;

            p.alphaStart = 1;
            p.alphaEnd = 0;

            p.rotation = Math.random() * Math.PI * 2;
            p.rotationSpeed = (Math.random() - 0.5) * 0.2;

            p.colorStart = color;
            p.view.tint = color; // Static color for now
        }
    }

    private getParticle(): ParticleData | null {
        let p: ParticleData;

        if (this.pool.length > 0) {
            p = this.pool.pop()!;
        } else {
            // Expand pool
            const view = new Sprite(this.texture);
            view.anchor.set(0.5);
            this.container.addChild(view);

            p = {
                x: 0, y: 0, vx: 0, vy: 0,
                life: 0, maxLife: 1,
                scaleStart: 1, scaleEnd: 1,
                alphaStart: 1, alphaEnd: 1,
                rotation: 0, rotationSpeed: 0,
                colorStart: new Color(0xFFFFFF),
                colorEnd: new Color(0xFFFFFF),
                active: true,
                view: view
            };
        }

        p.active = true;
        p.view.visible = true;
        // Ensure view is in container if somehow removed
        // if(p.view.parent !== this.container) this.container.addChild(p.view);

        return p;
    }

    private returnParticle(index: number) {
        const p = this.particles[index];
        p.active = false;
        p.view.visible = false;

        // Fast Remove
        const last = this.particles[this.particles.length - 1];
        this.particles[index] = last;
        this.particles.pop();

        this.pool.push(p);
    }
}
