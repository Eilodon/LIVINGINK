import { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, Texture, Graphics } from 'pixi.js';
import { GridSystem } from '../../../../packages/games/ngu-hanh/systems/GridSystem';
import { CycleSystem } from '../../../../packages/games/ngu-hanh/systems/CycleSystem';
import { ElementType } from '../../../../packages/games/ngu-hanh/types';
import { AssetManager } from '../game/systems/AssetManager';
import { ParticleManager } from '../game/systems/ParticleManager';
import { FluidRenderer } from '../../../../packages/engine/src/renderer/FluidRenderer';
import { audioManager } from '../game/engine/AudioManager';

export const GameCanvas = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [score, setScore] = useState(0);
    const [cycleStats, setCycleStats] = useState({
        target: ElementType.WATER,
        multiplier: 1,
        chainLength: 0,
        avatarState: false
    });

    // Systems
    const systemRef = useRef<GridSystem>(new GridSystem(8, 8));
    // ...
    // In updateLoop (Need to update setCycleStats call too)
    // But I can't multi-edit easily if lines are far part.
    // I will use replace_file_content for the HUD part primarily, 
    // and a separate one for updateLoop if needed, or try to catch both if close.
    // They are far apart (Line 13 vs 302 vs 167).
    // I will do 3 chunks using multi_replace_file_content.

    const cycleRef = useRef<CycleSystem>(new CycleSystem());
    const appRef = useRef<Application | null>(null);
    const assetManagerRef = useRef<AssetManager | null>(null);
    const particleManagerRef = useRef<ParticleManager | null>(null);
    const fluidRendererRef = useRef<FluidRenderer | null>(null);
    const spritesRef = useRef<Sprite[]>([]); // Pool of sprites
    const traumaRef = useRef(0); // Screen shake trauma

    useEffect(() => {
        const initGame = async () => {
            if (!canvasRef.current) return;

            // 1. Initialize WASM
            console.time("WASM Boot");
            try {
                await systemRef.current.initialize();
                console.timeEnd("WASM Boot");
            } catch (e) {
                console.error("WASM Boot Failed", e);
                return;
            }

            // 2. Initialize PixiJS
            const app = new Application();
            await app.init({
                canvas: canvasRef.current,
                width: 800,
                height: 800,
                backgroundColor: 0x111827, // Slate-900
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
            appRef.current = app;

            // 3. Initialize Assets
            const assetManager = new AssetManager(app);
            await assetManager.loadAssets();
            assetManagerRef.current = assetManager;

            // 4. Initialize Particles
            const gameContainer = new Container();
            app.stage.addChild(gameContainer);

            const gridContainer = new Container();
            gridContainer.x = 50;
            gridContainer.y = 50;
            gameContainer.addChild(gridContainer);

            const vfxContainer = new Container();
            vfxContainer.x = 50;
            vfxContainer.y = 50;
            gameContainer.addChild(vfxContainer);

            const particleManager = new ParticleManager(app, vfxContainer);
            particleManagerRef.current = particleManager;

            // Living Ink Overlay
            const inkOverlay = new Sprite(particleManager.getInkTexture());
            inkOverlay.alpha = 0.3;
            gameContainer.addChild(inkOverlay);

            // 5a. Initialize FluidRenderer (WebGPU)
            const fluidRenderer = new FluidRenderer(800, 800);
            fluidRendererRef.current = fluidRenderer;
            // Add to container (Overlay on top of Pixi Ink for now, or replace?)
            // Let's add it with additive blending or similar if possible.
            // For now just addChild.
            fluidRenderer.view.alpha = 0.5;
            gameContainer.addChild(fluidRenderer.view);

            // 5. Create Sprite Pool (8x8)
            const width = systemRef.current.getWidth();
            const height = systemRef.current.getHeight();
            const cellSize = 50;

            for (let i = 0; i < width * height; i++) {
                const sprite = new Sprite(Texture.EMPTY);
                sprite.width = cellSize - 2;
                sprite.height = cellSize - 2;
                sprite.x = (i % width) * cellSize;
                sprite.y = Math.floor(i / width) * cellSize;
                gridContainer.addChild(sprite);
                spritesRef.current.push(sprite);
            }

            // Apply Ink Filter to all sprites
            particleManager.applyInkToSprites(spritesRef.current);

            // 6. Start Loop
            // PixiJS 8 uses app.ticker
            app.ticker.add((ticker) => updateLoop(ticker.deltaTime));

            // 7. Hover Handling (Subconscious UI)
            app.stage.eventMode = 'static';
            app.stage.hitArea = app.screen;

            app.stage.on('pointerdown', async () => {
                await audioManager.resume();
            });

            app.stage.on('pointermove', (event) => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                // Local position in canvas
                // Note: event.global is screen space, but we need relative to container (x=50,y=50)

                // Using simple math for now
                // Container is at 50,50
                const localX = event.global.x - 50;
                const localY = event.global.y - 50;

                const col = Math.floor(localX / 50);
                const row = Math.floor(localY / 50);

                if (col >= 0 && col < width && row >= 0 && row < height) {
                    const preview = systemRef.current.previewInteraction(
                        null, // world
                        cycleRef.current,
                        row, col
                    );

                    // Send to visual feedback (State)
                    setPreviewState(preview);
                } else {
                    setPreviewState(null);
                }
            });

            setIsReady(true);
        };

        if (!appRef.current) {
            initGame();
        }

        return () => {
            if (appRef.current) {
                appRef.current.destroy(true, { children: true, texture: true });
                appRef.current = null;
            }
            spritesRef.current = [];
            if (fluidRendererRef.current) {
                fluidRendererRef.current.destroy();
                fluidRendererRef.current = null;
            }
        };
    }, []);

    // Preview State
    const [previewState, setPreviewState] = useState<import('../../../../packages/games/ngu-hanh/types').InteractionPreview | null>(null);
    const prevCellsRef = useRef<Uint8Array | null>(null);
    const spriteScalesRef = useRef<Float32Array>(new Float32Array(64).fill(1));

    const updateLoop = (dt: number) => {
        const gridSystem = systemRef.current;
        const cycleSystem = cycleRef.current;
        const assetManager = assetManagerRef.current;
        const particleManager = particleManagerRef.current;
        const app = appRef.current;

        if (!gridSystem || !assetManager || !particleManager || !app) return;

        // 1. Update Physics
        gridSystem.update(16.0);

        // Update Fluid
        if (fluidRendererRef.current) {
            fluidRendererRef.current.update(dt * 0.016, app.renderer);
            gridSystem.updateFromFluid(fluidRendererRef.current).catch(e => { });
        }

        // 2. Process Game Events
        const matches = gridSystem.findMatches(null);
        if (matches.size > 0) {
            const cycleResult = gridSystem.resolveMatches(null, { removeEntity: () => { } }, matches, cycleSystem);
            setCycleStats({
                target: cycleSystem.getCurrentTarget(),
                multiplier: cycleSystem.getStats().multiplier,
                chainLength: cycleSystem.getChainLength(),
                avatarState: cycleSystem.isAvatarStateActive()
            });

            if (cycleResult.isAvatarState) {
                traumaRef.current += 0.8;
            }
        }

        // 3. Process Visual Events
        const renderEvents = gridSystem.getFluidEvents();
        let addedTrauma = 0;

        if (renderEvents.length > 0) {
            for (let i = 0; i < renderEvents.length; i++) {
                const data = renderEvents[i];
                const type = (data >>> 24) & 0xFF; // Type
                const x = (data >>> 16) & 0xFF;
                const y = (data >>> 8) & 0xFF;
                const px = x * 50 + 25;
                const py = y * 50 + 25;

                switch (type) {
                    case 21: particleManager.spawnSparks(px, py); audioManager.playMetal(); addedTrauma += 0.3; break;
                    case 22: particleManager.spawnLeaves(px, py); audioManager.playWood(); addedTrauma += 0.2; break;
                    case 23: particleManager.spawnDroplets(px, py); audioManager.playWater(); addedTrauma += 0.3; break;
                    case 24: particleManager.spawnEmbers(px, py); particleManager.spawnSparks(px, py); audioManager.playFire(); addedTrauma += 0.4; break;
                    case 25: particleManager.spawnDust(px, py); audioManager.playEarth(); addedTrauma += 0.2; break;
                    default: break;
                }
            }
            gridSystem.clearEvents();
        }

        // Apply Trauma
        if (addedTrauma > 0) traumaRef.current = Math.min(1.0, traumaRef.current + addedTrauma);
        traumaRef.current = Math.max(0, traumaRef.current - 0.05 * dt);
        if (traumaRef.current > 0 && appRef.current) {
            const shake = traumaRef.current * traumaRef.current * 15;
            const angle = Math.random() * Math.PI * 2;
            appRef.current.stage.position.set(Math.cos(angle) * shake, Math.sin(angle) * shake);
        } else if (appRef.current) {
            appRef.current.stage.position.set(0, 0);
        }

        // 4. Render Grid State & Visual Feedback
        const cells = gridSystem.getCells();
        const sprites = spritesRef.current;
        const scales = spriteScalesRef.current;
        const prevCells = prevCellsRef.current;

        // Resize scales buffer if needed
        if (scales.length !== cells.length / 2) {
            spriteScalesRef.current = new Float32Array(cells.length / 2).fill(1);
        }

        // Logic Loop for Visuals
        for (let i = 0; i < sprites.length; i++) {
            const byteIdx = i * 2;
            if (byteIdx >= cells.length) break;

            const element = cells[byteIdx];
            const sprite = sprites[i];

            // Change Detection: Spawn Pop
            if (prevCells) {
                const prevElem = prevCells[byteIdx];
                if (prevElem === 0 && element !== 0) {
                    scales[i] = 0.0; // Reset scale for pop-in
                }
            }

            // Interpolate Scale
            // target is 1.0 normally, 1.1 if hovered/previewed
            let targetScale = 1.0;
            if (previewState) {
                // If this tile is affected, pulse it
                const isAffected = previewState.affectedTiles.some(t => (t.row * gridSystem.getWidth() + t.col) === i);
                if (isAffected) targetScale = 1.15;
            }

            // Simple Lerp: current += (target - current) * 0.2
            scales[i] += (targetScale - scales[i]) * 0.2 * dt;

            // Render
            if (element === 0) {
                sprite.visible = false;
            } else {
                sprite.visible = true;
                sprite.scale.set(scales[i]); // Apply Scale

                // Texture update logic...
                let key = 'element_metal';
                switch (element) {
                    case 1: key = 'element_metal'; break;
                    case 2: key = 'element_wood'; break;
                    case 3: key = 'element_water'; break;
                    case 4: key = 'element_fire'; break;
                    case 5: key = 'element_earth'; break;
                    case 10: key = 'mod_stone'; break;
                    case 11: key = 'mod_ash'; break;
                }
                const tex = assetManager.getTexture(key);
                if (sprite.texture !== tex) sprite.texture = tex;
            }

            // Apply Tint from Preview
            sprite.tint = 0xFFFFFF; // Reset
        }

        // Post-Loop: Tinting 
        // (Moved out of main loop or integrated? Integrated is better but previewState loop is easier separate)
        if (previewState) {
            previewState.affectedTiles.forEach(tile => {
                const sIdx = tile.row * gridSystem.getWidth() + tile.col;
                if (sIdx < sprites.length) {
                    const type = tile.type || previewState.type;
                    if (type === 'destruction') sprites[sIdx].tint = 0xFF6B6B;
                    else if (type === 'generation') sprites[sIdx].tint = 0x4ECDC4;
                }
            });
        }

        // Store copy of cells for next frame
        if (!prevCellsRef.current || prevCellsRef.current.length !== cells.length) {
            prevCellsRef.current = new Uint8Array(cells);
        } else {
            prevCellsRef.current.set(cells);
        }
    };

    const handleMouseClick = (e: React.MouseEvent) => {
        if (!isReady || !canvasRef.current || !systemRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        const mouseX = (e.clientX - rect.left) * scaleX - 50; // -50 because container x=50
        const mouseY = (e.clientY - rect.top) * scaleY - 50;

        const col = Math.floor(mouseX / 50);
        const row = Math.floor(mouseY / 50);

        if (col >= 0 && col < systemRef.current.getWidth() && row >= 0 && row < systemRef.current.getHeight()) {
            if (col < systemRef.current.getWidth() - 1) {
                if (col < systemRef.current.getWidth() - 1) {
                    // Client-side optimistic swap (visual only, logic handled by Rust/Server eventually)
                    // Passing null for world/entityManager as this is pure client-side prediction/input
                    systemRef.current.trySwap(null, null, col, row, col + 1, row);
                }
            }
        }
    };

    if (!isReady) return <div className="text-white p-10 font-bold">Initializing Living Ink Engine...</div>;

    return (
        <div className="flex flex-col items-center h-screen bg-black relative">
            {/* HUD OVERLAY */}
            <div className="absolute top-4 left-4 text-white font-mono z-10 p-4 bg-slate-900/80 rounded-lg border border-slate-700 pointer-events-none">
                <div className="text-2xl font-bold text-yellow-500 font-serif">SCORE: {score}</div>
                <div className="mt-2 border-t border-slate-700 pt-2">
                    <div className="text-xs text-slate-400 uppercase tracking-widest">Ritual Cycle</div>
                    <div className="text-xl font-bold" style={{ color: getElementColor(cycleStats.target) }}>
                        Next: {ElementType[cycleStats.target]}
                    </div>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                    <span>Chain: <span className="text-green-400 font-bold">{cycleStats.chainLength}</span></span>
                    <span>Mult: <span className="text-purple-400 font-bold">{cycleStats.multiplier}x</span></span>
                    {cycleStats.avatarState && (
                        <span className="text-yellow-400 font-bold animate-pulse">AVATAR STATE!</span>
                    )}
                </div>
            </div>

            <canvas
                ref={canvasRef}
                className="border-2 border-slate-700 bg-slate-900 shadow-2xl shadow-purple-900/20 rounded-lg cursor-pointer mt-10"
                onClick={handleMouseClick}
            />

            <div className="mt-4 text-slate-500 text-sm font-mono">
                Click tile to swap RIGHT • Phase 2 Beta
            </div>
        </div>
    );
};

// UI Helper
function getElementColor(type: number) {
    switch (type) {
        case 1: return '#E0E0E0';
        case 2: return '#4CAF50';
        case 3: return '#2196F3';
        case 4: return '#FF5722';
        case 5: return '#795548';
        default: return '#FFF';
    }
}
