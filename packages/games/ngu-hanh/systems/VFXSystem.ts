import { Container } from 'pixi.js';
import { AudioManager } from '../audio/AudioManager.js';

export class VFXSystem {
    private container: Container;
    private trauma: number = 0;
    private time: number = 0;

    constructor(container: Container) {
        // Assume container is passed with its original position but we override it during shake
        this.container = container;
        this.container.pivot.set(400, 400); // Set pivot to center for rotation
        this.container.position.set(450, 450); // Restore position (50+400)
    }

    public triggerShake(amount: number) {
        // Amount 0-1. Trauma adds up.
        this.trauma = Math.min(1.0, this.trauma + amount * 0.1);
    }

    public update(dt: number) {
        this.time += dt;

        // Decay Trauma
        this.trauma = Math.max(0, this.trauma - 1.0 * dt);

        if (this.trauma > 0) {
            const shake = this.trauma * this.trauma; // Quadratic feel
            // Perlin noise would be better but simple sin/cos is fine for MVP
            const angle = this.time * 20;
            const offsetX = (Math.cos(angle * 1.1) + Math.cos(angle * 0.3)) * shake * 20;
            const offsetY = (Math.sin(angle * 1.2) + Math.sin(angle * 0.5)) * shake * 20;
            const rot = (Math.random() - 0.5) * shake * 0.05;

            // Base position is (450, 450) because of pivot (400,400) + offset (50,50)
            this.container.position.set(450 + offsetX, 450 + offsetY);
            this.container.rotation = rot;
        } else {
            this.container.position.set(450, 450);
            this.container.rotation = 0;
        }

        // Pulse (Beat)
        const bass = AudioManager.getInstance().getBassEnergy();
        const pulse = 1.0 + bass * 0.05;
        this.container.scale.set(pulse);
    }
}
