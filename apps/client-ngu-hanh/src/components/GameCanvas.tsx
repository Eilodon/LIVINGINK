import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { WasmAdapter } from '@cjr/engine';
import { FluidSystem } from '@cjr/engine';
import { NetworkManager } from '../network/NetworkManager';

export const GameCanvas = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const wasmAdapterRef = useRef<WasmAdapter | null>(null);
    const networkManagerRef = useRef<NetworkManager | null>(null);
    const entityGraphicsMap = useRef<Map<number, Graphics>>(new Map());

    useEffect(() => {
        const initGame = async () => {
            if (!containerRef.current) return;

            // 1. Setup PixiJS
            const app = new Application();
            await app.init({
                width: window.innerWidth,
                height: window.innerHeight,
                preference: 'webgpu', // Use WebGPU!
                backgroundColor: 0x000000,
            });
            containerRef.current.appendChild(app.canvas);
            appRef.current = app;

            // 2. Setup Fluid System (WebGPU)
            const fluidSystem = new FluidSystem(app.stage, app.screen.width, app.screen.height);
            await fluidSystem.init();

            // 3. Setup WASM Adapter
            const wasmAdapter = new WasmAdapter();
            await wasmAdapter.initialize('/core_rust_bg.wasm');

            // Link them: WASM -> Fluid
            wasmAdapter.setFluidSystem(fluidSystem);

            wasmAdapterRef.current = wasmAdapter;

            // 4. Setup Networking
            const network = new NetworkManager();
            networkManagerRef.current = network;

            // Entity Rendering Layer
            const entitiesContainer = new Container();
            app.stage.addChild(entitiesContainer);

            network.onEntityAdd = (id, data) => {
                console.log("Client: Adding entity visual", id);
                const g = new Graphics();
                g.circle(0, 0, 10);
                g.fill(0xff0000); // Red player
                if (data.pos) {
                    g.x = data.pos.x;
                    g.y = data.pos.y;
                }
                entitiesContainer.addChild(g);
                entityGraphicsMap.current.set(id, g);
            };

            network.onEntityRemove = (id) => {
                console.log("Client: Removing entity visual", id);
                const g = entityGraphicsMap.current.get(id);
                if (g) {
                    entitiesContainer.removeChild(g);
                    g.destroy();
                    entityGraphicsMap.current.delete(id);
                }
            };

            await network.connect();

            // 5. Start Game Loop
            app.ticker.add((ticker) => {
                const dt_ms = ticker.deltaMS;

                // Update Local Simulation (Fluid + WASM Stub)
                wasmAdapter.update(dt_ms);

                // Update Network Entities Visuals
                network.entities.forEach((data, id) => {
                    const g = entityGraphicsMap.current.get(id);
                    if (g && data.pos) {
                        // Lerp position for smoothness? For now raw.
                        g.x = data.pos.x;
                        g.y = data.pos.y;
                    }
                });
            });
        };

        initGame();

        return () => {
            // Cleanup
            appRef.current?.destroy({ removeView: true });
            // Close connection?
        };
    }, []);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};
