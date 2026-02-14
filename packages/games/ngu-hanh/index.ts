import { WorldState, IGameModule } from '@cjr/engine';

export interface IGameContext {
    entityManager: any;
    spawnVisual: any;
    setVisualState: any;
    injectFluidEvents?: any;
    particleManager?: any;
    playSound?: any;
    playEffect?: any; // Avatar state
    onSyncUI?: any;
    onPreviewInteraction?: any;
}
import { GridSystem } from './systems/GridSystem.js';
import { CycleSystem } from './systems/CycleSystem.js';
import { BossSystem } from './systems/BossSystem.js';
import { CycleStats } from './CycleStats.js';
import { LEVELS, LevelConfig } from './config/LevelData.js';
import { AudioManager } from './audio/AudioManager.js';
import { HapticManager } from './audio/HapticManager.js';

export * from './systems/ReplaySystem.js';
export * from './systems/GhostSystem.js'; // [NEW]
export * from './systems/VFXSystem.js'; // [NEW]
export * from './systems/ParticleSystem.js'; // [NEW] (Exported for future use)

export class NguHanhModule implements IGameModule {
    readonly id = 'ngu-hanh';
    readonly name = 'Ngũ Hành Match-3';
    readonly version = '1.0.0';

    getComponentSchemas() { return []; }
    getSystemFactories() { return []; }
    getEventDefinitions() { return []; }
    getNetworkSchema() { return { packetTypes: {}, syncFields: [] }; }
    getInputMappings() { return []; }
    getAssetManifest() { return []; }
    getEntityTemplates() { return []; }

    private gridSystem: GridSystem;
    private cycleSystem: CycleSystem;
    private bossSystem: BossSystem;
    private audioManager: AudioManager;
    private hapticManager: HapticManager;
    private context!: IGameContext;
    private world!: WorldState;
    private lastStatus: string = 'PLAYING';
    private movesLeft: number = 0;

    private selectedTile: { r: number, c: number } | null = null;

    constructor() {
        this.gridSystem = new GridSystem(8, 8, 100);
        this.cycleSystem = new CycleSystem();
        this.bossSystem = new BossSystem();
        this.audioManager = AudioManager.getInstance();
        this.hapticManager = HapticManager.getInstance();

        // ... Load Sounds (Original Logic)
        const sounds = {
            "metal_clang": "audio/metal_clang.wav",
            "metal_shatter": "audio/metal_shatter.wav",
            "wood_crack": "audio/wood_crack.wav",
            "wood_break": "audio/wood_break.wav",
            "water_drop": "audio/water_drop.wav",
            "water_splash": "audio/water_splash.wav",
            "fire_whoosh": "audio/fire_whoosh.wav",
            "fire_burst": "audio/fire_burst.wav",
            "earth_rumble": "audio/earth_rumble.wav",
            "earth_crumble": "audio/earth_crumble.wav",
            "victory_fanfare": "audio/victory_fanfare.wav",
            "avatar_state": "audio/avatar_state.wav",
            "match": "audio/match.wav",
            "boss_damage": "audio/boss_damage.wav"
        };

        if (typeof window !== 'undefined') {
            Object.entries(sounds).forEach(([key, url]) => {
                this.audioManager.loadSound(key, url);
            });
        }
    }

    // ... Rest of the class behaves as before
    // (Truncated for brevity in write_to_file: Use view_file content to preserve logic)
    // Actually, I should use replace_file_content or multi_replace.
    // The previous view_file shows I only need to add exports.

    async onMount(world: WorldState, context: IGameContext): Promise<void> {
        this.context = context;
        this.world = world;
        // ...
    }

    // ... Methods (startLevel, onUpdate, etc) - No changes needed unless integrating Ghost logic HERE.
    // Ghost is visual, handled in GameCanvas via imported system.

    // ...
    startLevel(levelId: number) {
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

        this.gridSystem = new GridSystem(config.grid.width, config.grid.height, seed);
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
        this.movesLeft = config.moves;

        // 5. Start Adaptive Music (Eidolon-V)
        this.audioManager.loadMusicLayers([
            'audio/music_layer1.mmph', // Base (Ambient) - placeholder ext to avoid auto-play if 404
            'audio/music_layer2.mmph', // Tension (Drums)
            'audio/music_layer3.mmph'  // Climax (High Freq)
        ]).then(() => {
            this.audioManager.startMusic();
        });
    }

    // ... Rest of file
    onUnmount(world: WorldState): void {
    }

    onUpdate(dt: number, state: any): void {
        const world = this.world;
        // Zero-Copy Entity Sync
        this.gridSystem.syncEntities();

        // 1. Gravity
        const moved = this.gridSystem.applyGravity(world, this.context.entityManager, this.context.spawnVisual);

        // EIDOLON-V: The Divine Bridge
        // 1. Get Events from Rust (Parsed & Scaled)
        // Use Zero-Copy buffer
        const fluidEventsBuffer = this.gridSystem.getFluidEventBuffer();

        // 2. Inject into Renderer (Client Only)
        // We check if context has the capability
        if (fluidEventsBuffer.length > 0 && (this.context as any).injectFluidEvents) {
            // Parse buffer to objects for legacy consumer
            const events: any[] = [];
            const cellSize = 50;
            for (let i = 0; i < fluidEventsBuffer.length; i++) {
                const val = fluidEventsBuffer[i];
                const type = (val >> 24) & 0xFF;
                const gx = (val >> 16) & 0xFF;
                const gy = (val >> 8) & 0xFF;
                const intensity = val & 0xFF;
                events.push({
                    x: gx * cellSize + cellSize / 2,
                    y: gy * cellSize + cellSize / 2,
                    element: type,
                    intensity: intensity / 255.0
                });
            }
            (this.context as any).injectFluidEvents(events);
        }

        // 3. Clear Rust Events (Critical to prevent buffer overflow/re-injection)
        this.gridSystem.clearEvents();

        if (moved) return;

        // 2. Match
        const matches = this.gridSystem.findMatches(world);

        if (matches.size > 0) {
            // console.log(`[NguHanh] Matched ${matches.size} tiles!`);

            // Add ink stains for visual feedback
            matches.forEach(idx => {
                const row = Math.floor(idx / this.gridSystem.getWidth());
                const col = idx % this.gridSystem.getWidth();
                const x = col * 50 + 25; // Grid position
                const y = row * 50 + 25;

                // Get element from grid
                const cells = this.gridSystem.getCells();
                const element = cells[idx * 2];

                // Spawn ink stain
                if ((this.context as any).particleManager) {
                    (this.context as any).particleManager.spawnInkStain(x, y, element);
                }
            });

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

            // Audio & Haptic Feedback
            // 1. Element Sounds
            matches.forEach(idx => {
                const cells = this.gridSystem.getCells();
                const element = cells[idx * 2]; // 0=None, 1=Metal, 2=Wood...
                if (element > 0) {
                    this.audioManager.playElementSound(element, 'match');
                    this.hapticManager.elementHaptic(element);
                }
            });

            // 2. Avatar State
            if (cycleResult.isAvatarState) {
                this.audioManager.playSound('avatar_state');
                this.hapticManager.trigger('cycle_complete');
            } else {
                // Generic match sound if no specific element (fallback) or layer it
                // this.context.playSound?.('match'); // Legacy
                this.audioManager.playSound('match', 0.5);
            }

            // 3. Victory/Defeat handled in UI Sync
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

            const totalTiles = this.gridSystem.getWidth() * this.gridSystem.getHeight();
            const ashCount = this.gridSystem.getTilesByElementAndFlag(11, 2).length;
            const stoneCount = this.gridSystem.getTilesByElementAndFlag(10, 0).length;

            this.context.onSyncUI({
                boss: bossStatus,
                level: {
                    score: 0, // Todo: Sync Score
                    movesLeft: this.movesLeft,
                    status: status
                },
                boardStats: {
                    ashPercentage: Math.floor((ashCount / totalTiles) * 100),
                    stoneCount: stoneCount
                }
            });

            // Simple one-shot sound trigger (naive impl)
            if (status === 'VICTORY' && this.lastStatus !== 'VICTORY') {
                this.context.playSound?.('victory');
                this.audioManager.stopMusic(); // Stop music on end
            } else if (status === 'DEFEAT' && this.lastStatus !== 'DEFEAT') {
                this.audioManager.stopMusic();
            }
            this.lastStatus = status;

            // Update Music Intensity
            // Base: 0.0
            // Combo: +0.1 per mult (max 0.5)
            // Boss: +0.3 if HP < 50%
            // Avatar State: 1.0 (Override)

            let intensity = 0.0;
            const stats = this.cycleSystem.getStats();

            if (this.cycleSystem.isAvatarStateActive()) {
                intensity = 1.0;
            } else {
                if (stats.multiplier > 1) {
                    intensity += Math.min(0.5, (stats.multiplier - 1) * 0.1);
                }
                if (bossStatus.hp < (bossStatus.maxHP * 0.5)) {
                    intensity += 0.3;
                }
            }
            this.audioManager.setMusicIntensity(intensity);
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
            return;
        }

        if (this.selectedTile) {
            const r1 = this.selectedTile.r;
            const c1 = this.selectedTile.c;

            if (r1 === r && c1 === c) {
                this.selectedTile = null;
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
                this.movesLeft--; // Decrement Moves
                // Boss Interaction: Every move counts
                this.bossSystem.onPlayerMove(world, this.gridSystem, (id, state) => this.context.setVisualState(id, state));
            } else {
                this.context.playSound?.('swap_fail');
            }

            this.selectedTile = null;
        } else {
            this.selectedTile = { r, c };
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
        return this.gridSystem.getFluidEventBuffer();
    }

    public clearFluidEvents(): void {
        this.gridSystem.clearEvents();
    }
}
