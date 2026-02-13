import { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, Texture, Graphics } from 'pixi.js';
import { GridSystem } from '../../../../packages/games/ngu-hanh/systems/GridSystem';
import { CycleSystem } from '../../../../packages/games/ngu-hanh/systems/CycleSystem';
import { ElementType } from '../../../../packages/games/ngu-hanh/types';
import { AssetManager } from '../game/systems/AssetManager';
import { ParticleManager } from '../game/systems/ParticleManager';

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

            // 6. Start Loop
            // PixiJS 8 uses app.ticker
            app.ticker.add((ticker) => updateLoop(ticker.deltaTime));

            // 7. Hover Handling (Subconscious UI)
            app.stage.eventMode = 'static';
            app.stage.hitArea = app.screen;

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
        };
    }, []);

    // Preview State
    const [previewState, setPreviewState] = useState<import('../../../../packages/games/ngu-hanh/types').InteractionPreview | null>(null);

    const updateLoop = (dt: number) => {
        const gridSystem = systemRef.current;
        const cycleSystem = cycleRef.current;
        const assetManager = assetManagerRef.current;
        const particleManager = particleManagerRef.current;
        const app = appRef.current;

        if (!gridSystem || !assetManager || !particleManager || !app) return;

        // 1. Update Physics
        gridSystem.update(16.0);

        // 2. Process Game Events (Matches, Cycle)
        const matchEvents = gridSystem.getMatchEvents();
        if (matchEvents.length > 0) {
            // Logic is now handled in Rust Tick
            gridSystem.clearMatchEvents();
            setScore(gridSystem.getScore());

            // Sync Cycle Status from Rust Core
            setCycleStats({
                target: gridSystem.getCycleTarget(),
                multiplier: gridSystem.getCycleMultiplier(),
                chainLength: gridSystem.getCycleChain(),
                avatarState: (gridSystem as any).isAvatarStateActive ? (gridSystem as any).isAvatarStateActive() : false
            });
        }

        // 3. Process Visual Events (Particles, Shake)
        const renderEvents = gridSystem.getFluidEvents();
        let addedTrauma = 0;

        if (renderEvents.length > 0) {
            // ... (Existing Event Processing) ...
            // Reusing existing logic but keeping it concise here
            for (let i = 0; i < renderEvents.length; i++) {
                const data = renderEvents[i];
                const type = (data >>> 24) & 0xFF;
                const x = (data >>> 16) & 0xFF;
                const y = (data >>> 8) & 0xFF;
                const px = x * 50 + 25;
                const py = y * 50 + 25;

                // Particle spawning logic...
                // (Copied from existing for safety, or we can trust the replaced block encompasses it)
                // Wait, if I replace the whole loop, I need to include the body.
                // The previous code had the Switch Case.
                // I will include it.

                switch (type) {
                    case 21: particleManager.spawnSparks(px, py); addedTrauma += 0.3; break;
                    case 22: particleManager.spawnLeaves(px, py); addedTrauma += 0.2; break;
                    case 23: particleManager.spawnDroplets(px, py); addedTrauma += 0.3; break;
                    case 24: particleManager.spawnEmbers(px, py); particleManager.spawnSparks(px, py); addedTrauma += 0.4; break;
                    case 25: particleManager.spawnDust(px, py); addedTrauma += 0.2; break;
                    case 31: particleManager.spawnDroplets(px, py); break;
                    case 32: particleManager.spawnEmbers(px, py); break;
                    case 33: particleManager.spawnLeaves(px, py); break;
                    default: break;
                }
            }
            gridSystem.clearEvents();
        }

        // Apply Trauma...
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

        // Reset tints first
        for (let s of sprites) s.tint = 0xFFFFFF;

        // Apply Preview Tints
        if (previewState) {
            previewState.affectedTiles.forEach(tile => {
                const sIdx = tile.row * gridSystem.getWidth() + tile.col;
                if (sIdx < sprites.length) {
                    if (previewState.type === 'destruction') sprites[sIdx].tint = 0xFF6B6B; // Red
                    else if (previewState.type === 'generation') sprites[sIdx].tint = 0x4ECDC4; // Cyan
                }
            });
        }

        for (let i = 0; i < sprites.length; i++) {
            const byteIdx = i * 2;
            if (byteIdx >= cells.length) break;

            const element = cells[byteIdx];
            const sprite = sprites[i];

            if (element === 0) {
                sprite.visible = false;
            } else {
                sprite.visible = true;
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
                systemRef.current.trySwap(col, row, col + 1, row);
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
