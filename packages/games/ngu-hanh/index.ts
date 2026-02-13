import { WorldState, IGameModule, IGameContext } from '@cjr/engine';
import { GridSystem } from './systems/GridSystem';
import { CycleSystem } from './systems/CycleSystem';
import { BossSystem } from './systems/BossSystem';
import { CycleStats } from './CycleStats';

export class NguHanhModule implements IGameModule {
    readonly id = 'ngu-hanh';
    readonly name = 'Ngũ Hành Match-3';

    private gridSystem: GridSystem;
    private cycleSystem: CycleSystem;
    private bossSystem: BossSystem;
    private context!: IGameContext;

    private selectedTile: { r: number, c: number } | null = null;

    constructor() {
        this.gridSystem = new GridSystem(8, 8, 100);
        this.cycleSystem = new CycleSystem();
        this.bossSystem = new BossSystem();
    }

    async onMount(world: WorldState, context: IGameContext): Promise<void> {
        console.log(`[NguHanh] Module Mounted`);
        this.context = context;
        this.gridSystem.initialize(world, context.entityManager, context.spawnVisual);
        this.cycleSystem.reset();
        this.bossSystem.initialize(world, context.entityManager, 1);
    }

    onUnmount(world: WorldState): void {
        console.log('[NguHanh] Module Unmounted');
    }

    onUpdate(world: WorldState, dt: number): void {
        // 1. Gravity
        const moved = this.gridSystem.applyGravity(world, this.context.entityManager, this.context.spawnVisual);
        if (moved) return;

        // 2. Match
        const matches = this.gridSystem.findMatches(world);
        if (matches.size > 0) {
            console.log(`[NguHanh] Matched ${matches.size} tiles!`);
            // Pass cycleSystem to resolveMatches
            const cycleResult = this.gridSystem.resolveMatches(world, this.context.entityManager, matches, this.cycleSystem);

            // 3. Boss Damage
            if (cycleResult.isCycleHit) {
                this.bossSystem.onMatch(world, matches.size, cycleResult.multiplier);
            } else {
                // Base damage for non-cycle match? Or 0?
                // Let's give small base damage 
                this.bossSystem.onMatch(world, matches.size, 1);
            }
        }
    }

    onPlayerInput(world: WorldState, input: any): void {
        if (!input || input.type !== 'pointerdown') return;

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
                const idCurr = this.gridSystem.getEntityAt(r, c);
                if (idPrev !== -1) this.context.setVisualState(idPrev, 0); // IDLE
                if (idCurr !== -1) this.context.setVisualState(idCurr, 0); // IDLE
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
            } else {
                console.log("[NguHanh] Swap Failed (No Match)");
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
}
