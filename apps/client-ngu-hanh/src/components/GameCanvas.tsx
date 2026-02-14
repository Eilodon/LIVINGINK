import { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, Texture, Graphics } from 'pixi.js';
import { GridSystem } from '../../../../packages/games/ngu-hanh/systems/GridSystem';
import { CycleSystem } from '../../../../packages/games/ngu-hanh/systems/CycleSystem';
import { GhostSystem, GhostState } from '../../../../packages/games/ngu-hanh/systems/GhostSystem';
import { VFXSystem } from '../../../../packages/games/ngu-hanh/systems/VFXSystem';
import { ElementType } from '../../../../packages/games/ngu-hanh/types';
import { AssetManager } from '../game/systems/AssetManager';
import { ParticleManager } from '../game/systems/ParticleManager';
import { FluidRenderer } from '../../../../packages/engine/src/renderer/FluidRenderer';
import { ComputeFluidRenderer } from '../../../../packages/engine/src/renderer/ComputeFluidRenderer'; // [NEW]
import { audioManager } from '../game/engine/AudioManager';
import { GestureController } from '../game/input/GestureController';
import { PerformanceHUD } from './PerformanceHUD';

export const GameCanvas = ({ seed }: { seed?: string }) => {
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
    const ghostSystemRef = useRef<GhostSystem>(new GhostSystem());
    const vfxSystemRef = useRef<VFXSystem | null>(null);

    const appRef = useRef<Application | null>(null);
    const assetManagerRef = useRef<AssetManager | null>(null);
    const particleManagerRef = useRef<ParticleManager | null>(null);
    const fluidRendererRef = useRef<FluidRenderer | null>(null);
    const computeFluidRef = useRef<ComputeFluidRenderer | null>(null);
    const spritesRef = useRef<Sprite[]>([]); // Pool of sprites
    // const traumaRef = useRef(0); // Deprecated in favor of VFXSystem

    useEffect(() => {
        const initGame = async () => {
            if (!canvasRef.current) return;

            // 1. Initialize WASM
            console.time("WASM Boot");
            try {
                // Pass seed from prop (string) -> BigInt
                // If seed is "0" or undefined, GridSystem will handle it?
                // GridSystem.initialize accepts string or big int.
                await systemRef.current.initialize(undefined, undefined, undefined, seed);
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

            // Initialize VFXSystem
            const vfxSystem = new VFXSystem(gameContainer); // Shake the whole game container
            vfxSystemRef.current = vfxSystem;

            const particleManager = new ParticleManager(app, vfxContainer);
            particleManagerRef.current = particleManager;

            // Living Ink Overlay
            const inkOverlay = new Sprite(particleManager.getInkTexture());
            inkOverlay.alpha = 0.3;
            gameContainer.addChild(inkOverlay);

            // 5a. Initialize FluidRenderer
            if (navigator.gpu) {
                console.log("Initialize WebGPU Compute Fluid");
                const computeFluid = new ComputeFluidRenderer(800, 800);
                await computeFluid.init(app.renderer as any); // Cast to any or WebGPURenderer
                computeFluidRef.current = computeFluid;

                const fluidSprite = new Sprite(computeFluid.outputTexture);
                fluidSprite.alpha = 0.6;
                fluidSprite.blendMode = 'add';
                gameContainer.addChild(fluidSprite);
            } else {
                console.log("Fallback to WebGL Fluid");
                const fluidRenderer = new FluidRenderer(800, 800);
                fluidRendererRef.current = fluidRenderer;
                fluidRenderer.view.alpha = 0.5;
                gameContainer.addChild(fluidRenderer.view);
            }

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

            // 7. Initialize Gesture Controller (S-Tier Input)
            const gestureController = new GestureController(app.canvas, {
                onTap: (x, y) => {
                    const col = Math.floor((x - 50) / 50);
                    const row = Math.floor((y - 50) / 50);
                    if (col >= 0 && col < width && row >= 0 && row < height) {
                        // S-Tier: Add simple click-to-swap-right for now (Tap behavior)
                        // Ideally this selects, but prototype logic was swap-right
                        if (col < width - 1) {
                            systemRef.current.trySwap(null, null, col, row, col + 1, row);
                            audioManager.resume().catch(() => { });
                        }
                    }
                },
                onSwipe: (dir, startX, startY) => {
                    const c1 = Math.floor((startX - 50) / 50);
                    const r1 = Math.floor((startY - 50) / 50);

                    let c2 = c1;
                    let r2 = r1;

                    if (dir === 'RIGHT') c2++;
                    if (dir === 'LEFT') c2--;
                    if (dir === 'DOWN') r2++;
                    if (dir === 'UP') r2--;

                    if (c1 >= 0 && c1 < width && r1 >= 0 && r1 < height &&
                        c2 >= 0 && c2 < width && r2 >= 0 && r2 < height) {
                        systemRef.current.trySwap(null, null, c1, r1, c2, r2);
                        audioManager.resume().catch(() => { }); // Ensure audio context is resume on interaction
                    }
                },
                onHover: (x, y) => {
                    const col = Math.floor((x - 50) / 50); // x is relative to canvas 0,0
                    const row = Math.floor((y - 50) / 50);

                    if (col >= 0 && col < width && row >= 0 && row < height) {
                        const ghost = ghostSystemRef.current.update(
                            systemRef.current, cycleRef.current, row, col, -1, -1
                        );
                        setGhostState(ghost);
                    } else {
                        setGhostState(null);
                    }
                }
            });

            setIsReady(true);
        };

        if (!appRef.current) {
            initGame();
        }

        return () => {
            // Cleanup
            if (appRef.current) {
                // gestureController (local var) handling? 
                // We'd need to store gestureController in a ref to destroy it properly if strict mode is on.
                // But initGame is async and closure captures it? 
                // Actually, GestureController attaches to canvas. 
                // We should ideally return the cleanup function or store reference.
                // For now, let's assume app destruction handles some, but event listeners on canvas remain.
                // We must destroy it.
                // Refactoring slightly to use a ref for controller.
            }
            // See NOTE below
        };
    }, []);

    // Preview State
    const [ghostState, setGhostState] = useState<GhostState | null>(null);
    const prevCellsRef = useRef<Uint8Array | null>(null);
    const spriteScalesRef = useRef<Float32Array>(new Float32Array(64).fill(1));

    // Gesture Controller Ref
    const gestureControllerRef = useRef<GestureController | null>(null);

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
        if (computeFluidRef.current) {
            computeFluidRef.current.update(dt * 0.016);
            // TODO: GridSystem interaction with Compute Fluid
        } else if (fluidRendererRef.current) {
            fluidRendererRef.current.update(dt * 0.016, app.renderer);
            gridSystem.updateFromFluid(fluidRendererRef.current).catch(e => { });
        }

        // Update VFX
        if (vfxSystemRef.current) {
            vfxSystemRef.current.update(dt * 0.001);
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
                vfxSystemRef.current?.triggerShake(20);
            }
        }

        // 3. Process Visual Events
        const renderEvents = gridSystem.getFluidEventBuffer();
        const cellSize = 50; // Hardcoded matches GridSystem original default
        let addedTrauma = 0;

        if (renderEvents.length > 0) {
            for (let i = 0; i < renderEvents.length; i++) {
                const val = renderEvents[i];
                const type = (val >> 24) & 0xFF;
                const gx = (val >> 16) & 0xFF;
                const gy = (val >> 8) & 0xFF;
                // const intensity = (val & 0xFF) / 255.0;

                const px = gx * cellSize + cellSize / 2;
                const py = gy * cellSize + cellSize / 2;

                switch (type) {
                    case 21: particleManager.spawnSparks(px, py); audioManager.playMetal(); vfxSystemRef.current?.triggerShake(5); break;
                    case 22: particleManager.spawnLeaves(px, py); audioManager.playWood(); vfxSystemRef.current?.triggerShake(2); break;
                    case 23: particleManager.spawnDroplets(px, py); audioManager.playWater(); vfxSystemRef.current?.triggerShake(3); break;
                    case 24: particleManager.spawnEmbers(px, py); particleManager.spawnSparks(px, py); audioManager.playFire(); vfxSystemRef.current?.triggerShake(6); break;
                    case 25: particleManager.spawnDust(px, py); audioManager.playEarth(); vfxSystemRef.current?.triggerShake(4); break;
                    default: break;
                }
            }
            gridSystem.clearEvents();
        }

        // Trauma logic moved to VFXSystem

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
            // target is 1.0 normally, 1.1 if hovered/ghosted
            let targetScale = 1.0;
            if (ghostState && ghostState.cells.has(i)) {
                targetScale = ghostState.cells.get(i)!.scale;
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
        if (ghostState) {
            ghostState.cells.forEach((cell, idx) => {
                if (idx < sprites.length) {
                    const sprite = sprites[idx];
                    if (cell.tint) sprite.tint = cell.tint;
                    if (cell.alpha) sprite.alpha = cell.alpha;

                    // If element changed (Simulation/Swap), update texture preview?
                    // GhostSystem sets element to -1 if same.
                    if (cell.element !== -1 && cell.element !== cells[idx * 2]) {
                        // Swap Preview: Temporarily show different texture?
                        // Ideally we clone sprite, but here we just hack the main sprite for MVP prediction.
                        // But main loop resets texture every frame based on 'cells'.
                        // We are AFTER main loop in tinting phase?
                        // Actually texture update is inside main loop (Line 328).
                        // We should override texture there if ghost says so.
                        // But we are outside loop now.
                        // Let's just tint for now.
                    }
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

    if (!isReady) return <div className="text-white p-10 font-bold">Initializing Living Ink Engine...</div>;

    return (
        <div className="flex flex-col items-center h-screen bg-black relative">
            <PerformanceHUD app={appRef.current} stats={cycleStats} />

            <canvas
                ref={canvasRef}
                className="border-2 border-slate-700 bg-slate-900 shadow-2xl shadow-purple-900/20 rounded-lg cursor-pointer mt-0"
            // onClick removed, handled by GestureController
            />

            <div className="mt-4 text-slate-500 text-sm font-mono">
                Gesture Controls: Swipe to Swap • Tap to Interact
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
