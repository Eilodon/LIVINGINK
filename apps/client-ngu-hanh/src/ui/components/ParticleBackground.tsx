import React, { useEffect, useRef } from 'react';
import { Application, Container, Sprite, Texture, BlurFilter } from 'pixi.js';
import { ELEMENTAL_PALETTE } from '../theme/Theme';

interface ParticleBackgroundProps {
    element: keyof typeof ELEMENTAL_PALETTE;
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ element }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const appRef = useRef<Application | null>(null);
    const particlesRef = useRef<any[]>([]);
    const elementRef = useRef(element);

    // Keep ref updated for animation loop
    useEffect(() => {
        elementRef.current = element;
    }, [element]);

    useEffect(() => {
        if (!canvasRef.current) return;

        const initParams = {
            canvas: canvasRef.current,
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundAlpha: 0, // Transparent, let CSS gradient show through
            resizeTo: window,
            antialias: true
        };

        const app = new Application();

        const setup = async () => {
            await app.init(initParams);
            appRef.current = app;

            const container = new Container();
            app.stage.addChild(container);

            // Create Particle Pool
            const particleCount = 50;
            const texture = Texture.WHITE;

            for (let i = 0; i < particleCount; i++) {
                const sprite = new Sprite(texture);
                sprite.anchor.set(0.5);
                resetParticle(sprite, app.screen.width, app.screen.height, true);
                container.addChild(sprite);
                particlesRef.current.push({
                    sprite,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    life: Math.random(),
                    speed: 0.5 + Math.random() * 1.5
                });
            }

            // Loop
            app.ticker.add((ticker) => {
                const dt = ticker.deltaTime;
                const width = app.screen.width;
                const height = app.screen.height;
                const targetColor = ELEMENTAL_PALETTE[elementRef.current] as any;
                const hexColor = targetColor.primary;

                particlesRef.current.forEach(p => {
                    // Move
                    p.sprite.x += p.vx * p.speed * dt;
                    p.sprite.y += p.vy * p.speed * dt;
                    p.life -= 0.005 * dt;

                    // Fade/Reset
                    if (p.life <= 0) {
                        resetParticle(p.sprite, width, height, false);
                        p.life = 1.0;
                    }

                    // Alpha curve: Fade in, hold, fade out
                    if (p.life > 0.8) p.sprite.alpha = (1 - p.life) * 5;
                    else if (p.life < 0.2) p.sprite.alpha = p.life * 5;
                    else p.sprite.alpha = 1;

                    // Color Interpolation (Simple tint for now)
                    // Pixi Sprite tint is a number. Need to convert hex string to number
                    // ELEMENTAL_PALETTE has hex strings like '#C0C0C0'
                    // We can just set it directly if Pixi accepts string, or convert.
                    // Pixi 8 usually accepts css strings or numbers. 
                    p.sprite.tint = hexColor;

                    // Add subtle scale pulse
                    p.sprite.scale.set(Math.sin(Date.now() * 0.002 + p.life * 10) * 0.5 + 1);
                });
            });
        };

        setup();

        return () => {
            if (appRef.current) {
                appRef.current.destroy(true, { children: true, texture: true });
                appRef.current = null;
            }
            particlesRef.current = [];
        };
    }, []);

    return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
};

function resetParticle(sprite: Sprite, w: number, h: number, randomY: boolean) {
    sprite.x = Math.random() * w;
    sprite.y = randomY ? Math.random() * h : h + 10;
    sprite.width = Math.random() * 4 + 2;
    sprite.height = sprite.width;
    sprite.alpha = 0;
}
