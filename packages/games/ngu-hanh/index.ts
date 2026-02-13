import { WorldState, IGameModule, IGameContext } from '@cjr/engine';
import { GridSystem } from './systems/GridSystem.js';
import { CycleSystem } from './systems/CycleSystem.js';
import { BossSystem } from './systems/BossSystem.js';
import { CycleStats } from './CycleStats.js';
import { LEVELS, LevelConfig } from './config/LevelData.js';

export class NguHanhModule implements IGameModule {
    readonly id = 'ngu-hanh';
    readonly name = 'Ngũ Hành Match-3';

    private gridSystem: GridSystem;
    private cycleSystem: CycleSystem;
    private bossSystem: BossSystem;
    private context!: IGameContext;
    private world!: WorldState;
    private lastStatus: string = 'PLAYING';
    private movesLeft: number = 0;

    private selectedTile: { r: number, c: number } | null = null;

    constructor() {
        this.gridSystem = new GridSystem(8, 8, 100);
        this.cycleSystem = new CycleSystem();
        this.bossSystem = new BossSystem();
    }

    async onMount(world: WorldState, context: IGameContext): Promise<void> {
        console.log(`[NguHanh] Module Mounted`);
        this.context = context;
        this.world = world;

        // Wait for explicit startLevel call from Host
    }

    public startLevel(levelId: number) {
        console.log(`[NguHanh] Starting Level ${levelId}`);
        const config = LEVELS.find((l: LevelConfig) => l.id === levelId);
        if (!config) {
            console.error(`[NguHanh] Level ${levelId} not found!`);
            return;
        }

        // 1. Reset Grid
        if (this.gridSystem) {
            // Basic clear: iterate and remove
            for (let r = 0; r < this.gridSystem.getHeight(); r++) {
                for (let c = 0; c < this.gridSystem.getWidth(); c++) {
                    const id = this.gridSystem.getEntityAt(r, c);
                    if (id !== -1) {
                        this.context.entityManager.removeEntity(id);
                        this.context.setVisualState(id, 2); // Matched/Removed visual
                    }
                }
            }
        }

        // Generate Seed for this Level Session
        // In production, this might come from server or be hash of (LevelID + UserID + Time)
        // For now, random but logged for replayability if we were to save it.
        const seed = Date.now();
        console.log(`[NguHanh] Level ${levelId} Seed: ${seed}`);

        this.gridSystem = new GridSystem(config.grid.width, config.grid.height, 100, seed);
        this.gridSystem.initialize(this.world, this.context.entityManager, this.context.spawnVisual);

        // Apply Mods
        config.grid.mods.forEach((mod: { r: number, c: number, type: any }) => {
            const id = this.gridSystem.getEntityAt(mod.r, mod.c);
            if (id !== -1) {
                this.gridSystem.setMod(this.world, id, mod.type, (id, state) => this.context.setVisualState(id, state));
            }
        });

        // 2. Boss
        this.bossSystem = new BossSystem();
        // Use SAME seed for Boss to ensure sync? Or derived seed?
        // Using same seed is fine if they use RNG sequentially differently.
        // Or better: seed + 1
        this.bossSystem.initialize(this.world, this.context.entityManager, config.boss, seed + 1);

        // 3. Cycle & Game State
        this.cycleSystem.reset();

        // 4. Update UI
        // We need to tell UI about moves logic which is inside GridSystem?
        // Actually moves is in config.
        // We need to store movesLeft in GridSystem or Module.
        // GridSystem has movesLeft property? No, I saw logic in Module or GridSystem?
        // Let's check GridSystem again. It didn't seem to have movesLeft property in the file view.
        // Ah, `index.ts` had `this.gridSystem.movesLeft`.
        // Let's check if GridSystem HAS movesLeft.
        // I suspected it didn't in my viewer.
        // If not, I need to add it to Module.
        // Let's assume I need to manage it in Module.
        this.movesLeft = config.moves;
    }

    onUnmount(world: WorldState): void {
        console.log('[NguHanh] Module Unmounted');
    }

    onUpdate(world: WorldState, dt: number): void {
        // 1. Gravity
        const moved = this.gridSystem.applyGravity(world, this.context.entityManager, this.context.spawnVisual);

        // EIDOLON-V: The Divine Bridge
        // 1. Get Events from Rust
        const fluidEvents = this.gridSystem.getFluidEvents();

        // 2. Inject into Renderer (Client Only)
        // We check if context has the capability
        if (fluidEvents && (this.context as any).injectFluidEvents) {
            // Rust returns flat array or objects? 
            // In GridSystem.ts: return this.simulation.get_fluid_events()
            // In Rust: returns JsValue (array of objects {x,y,element,intensity})
            // We assume it's an array.
            // Only send if not empty
            // Actually Rust returns everything.
            (this.context as any).injectFluidEvents(fluidEvents);
        }

        // 3. Clear Rust Events (Critical to prevent buffer overflow/re-injection)
        this.gridSystem.clearEvents();

        if (moved) return;

        // 2. Match
        const matches = this.gridSystem.findMatches(world);
        if (matches.size > 0) {
            console.log(`[NguHanh] Matched ${matches.size} tiles!`);
            // Pass cycleSystem to resolveMatches
            const cycleResult = this.gridSystem.resolveMatches(world, this.context.entityManager, matches, this.cycleSystem);

            // Check for Avatar State
            if (cycleResult.isAvatarState) {
                // Trigger massive board clear
                this.gridSystem.clearBoard(world, this.context.entityManager);
                // Screen flash effect
                this.context.playEffect?.('avatar_state_flash');
                // Massive particle explosion
                this.context.playEffect?.('massive_explosion');
            }

            // Boss damage with cycle multiplier
            if (cycleResult.isCycleHit) {
                this.bossSystem.onMatch(world, matches.size, cycleResult.multiplier);
            } else {
                this.bossSystem.onMatch(world, matches.size, 1);
            }

            // Audio Feedback
            this.context.playSound?.('match');
        }
        // EIDOLON-V: UI Sync & Game End Check
        if (this.context.onSyncUI) {
            const bossStatus = this.bossSystem.getBossStatus(world);
            let status = 'PLAYING';

            if (bossStatus.hp <= 0) {
                status = 'VICTORY';
                // Only play sound once? relying on UI to handle "enter state" or simple spam prevention
                // For MVP, if it was playing last frame, trigger. 
                // We need local state to track if we already triggered end game.
            } else if (this.movesLeft <= 0) {
                status = 'DEFEAT';
            }

            this.context.onSyncUI({
                boss: bossStatus,
                level: {
                    score: 0, // Todo: Sync Score
                    movesLeft: this.movesLeft,
                    status: status
                }
            });

            // Simple one-shot sound trigger (naive impl)
            if (status === 'VICTORY' && this.lastStatus !== 'VICTORY') {
                this.context.playSound?.('victory');
            }
            this.lastStatus = status;
        }
    }

    onPlayerInput(world: WorldState, input: any): void {
        if (!input) return;

        // Subconscious UI: Hover Preview
        if (input.type === 'pointermove') {
            const [r, c] = this.gridSystem.getGridCoordinates(input.x, input.y);
            if (r !== -1 && c !== -1) {
                // Call Prediction System
                const prediction = this.gridSystem.previewInteraction(world, this.cycleSystem, r, c);

                // Send visual feedback to Client Context
                // We need to extend IGameContext to support 'setInteractionHint' or similar
                // For MVP, if we can't change interface, we assume input has a callback or we use existing spawnVisual?
                // Actually, IGameContext is defined in engine. Let's see if we can hack it or if we need to modify engine.
                // Assuming we can emit an event or call a method on context.
                // For now, let's log it to verify integration.
                // console.log(`[SubconsciousUI] Hover [${r},${c}] -> Type: ${prediction.type}, Affected: ${prediction.affectedTiles.length}`);

                if (this.context.onPreviewInteraction) {
                    this.context.onPreviewInteraction(prediction);
                }
            } else {
                // Clear prediction if outside grid
                if (this.context.onPreviewInteraction) {
                    this.context.onPreviewInteraction(null);
                }
            }
            return;
        }

        if (input.type !== 'pointerdown') return;

        const [r, c] = this.gridSystem.getGridCoordinates(input.x, input.y);

        if (r === -1 || c === -1) {
            this.selectedTile = null;
            console.log("[NguHanh] Clicked outside grid");
            return;
        }

        console.log(`[NguHanh] Clicked tile [${r}, ${c}]`);

        if (this.selectedTile) {
            const r1 = this.selectedTile.r;
            const c1 = this.selectedTile.c;

            if (r1 === r && c1 === c) {
                this.selectedTile = null;
                console.log("[NguHanh] Deselected tile");
                // Reset Visuals
                const idPrev = this.gridSystem.getEntityAt(r1, c1);
                // const idCurr = this.gridSystem.getEntityAt(r, c); // Same tile
                if (idPrev !== -1) this.context.setVisualState(idPrev, 0); // IDLE
                return;
            }

            const success = this.gridSystem.trySwap(world, this.context.entityManager, r1, c1, r, c);
            const id1 = this.gridSystem.getEntityAt(r1, c1); // Note: positions might be swapped or not
            const id2 = this.gridSystem.getEntityAt(r, c);

            // Reset visual states regardless of success (selection cleared)
            // But if success, they might match and be removed anyway
            if (id1 !== -1) this.context.setVisualState(id1, 0);
            if (id2 !== -1) this.context.setVisualState(id2, 0);

            if (success) {
                console.log("[NguHanh] Swap Successful!");
                this.movesLeft--; // Decrement Moves
                // Boss Interaction: Every move counts
                this.bossSystem.onPlayerMove(world, this.gridSystem, (id, state) => this.context.setVisualState(id, state));
            } else {
                console.log("[NguHanh] Swap Failed (No Match)");
                this.context.playSound?.('swap_fail');
            }

            this.selectedTile = null;
        } else {
            this.selectedTile = { r, c };
            console.log(`[NguHanh] Selected tile [${r}, ${c}]`);
            const id = this.gridSystem.getEntityAt(r, c);
            if (id !== -1) {
                this.context.setVisualState(id, 1); // SELECTED
            }
        }
    }

    public getCycleStats(): CycleStats {
        return this.cycleSystem.getStats();
    }

    public getFluidEvents(): any {
        return this.gridSystem.getFluidEvents();
    }

    public clearFluidEvents(): void {
        this.gridSystem.clearEvents();
    }
}
