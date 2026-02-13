import { WorldState, TransformAccess, StateAccess, EntityFlags, SkillAccess, EntityManager } from '@cjr/engine';
import { ElementType, TileMod } from '../types';
import { CycleSystem } from './CycleSystem';

export class GridSystem {
    private width: number;
    private height: number;
    private tileSize: number;
    private startX: number;
    private startY: number;

    // Grid: [row][col] -> entityId
    private grid: number[][];

    // Track Tile Modifications (Ash, Stone, etc.)
    // Key: Entity ID, Value: TileMod
    private tileMods: Map<number, TileMod> = new Map();

    constructor(width: number, height: number, tileSize: number) {
        this.width = width;
        this.height = height;
        this.tileSize = tileSize;

        // Center the grid
        this.startX = -(width * tileSize) / 2 + tileSize / 2;
        this.startY = -(height * tileSize) / 2 + tileSize / 2;

        this.grid = Array(height).fill(null).map(() => Array(width).fill(-1));
    }

    public getEntityAt(r: number, c: number): number {
        if (r < 0 || r >= this.height || c < 0 || c >= this.width) return -1;
        return this.grid[r][c];
    }

    public getMod(entityId: number): TileMod {
        return this.tileMods.get(entityId) || TileMod.NONE;
    }

    public setMod(world: WorldState, entityId: number, mod: TileMod, spawnVisual: (id: number, mod: TileMod) => void): void {
        this.tileMods.set(entityId, mod);
        // Trigger visual update
        spawnVisual(entityId, mod);
    }

    /**
     * Initialize grid with random elements
     */
    initialize(world: WorldState, entityManager: EntityManager, spawnVisual: (id: number, color: number, shape: number) => void): void {
        this.tileMods.clear();
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                this.spawnTile(world, entityManager, r, c, spawnVisual);
            }
        }
    }

    /**
     * Spawn a single tile at (r, c)
     */
    private spawnTile(world: WorldState, entityManager: EntityManager, r: number, c: number, spawnVisual: (id: number, color: number, shape: number) => void): number {
        const entityId = entityManager.createEntity();
        if (entityId === -1) return -1;

        StateAccess.activate(world, entityId);
        StateAccess.setFlag(world, entityId, EntityFlags.ACTIVE);

        // Position
        const x = this.getColumnX(c);
        const y = this.getRowY(r);
        TransformAccess.set(world, entityId, x, y, 0, 1, 0, 0, 0);

        // Element Type
        // Start simple: random types
        let type = Math.floor(Math.random() * 5);
        while (this.causesMatch(r, c, type)) {
            type = Math.floor(Math.random() * 5);
        }

        // Store Type in SkillAccess.shapeId (float)
        SkillAccess.setShapeId(world, entityId, type);

        // Visuals
        const color = this.getElementColor(type);
        spawnVisual(entityId, color, type);

        this.grid[r][c] = entityId;
        return entityId;
    }

    /**
     * Check if placing 'type' at (r, c) causes a match-3
     */
    private causesMatch(r: number, c: number, type: number): boolean {
        // Simplified check, relies on logic being correct elsewhere for now or just random luck prevention
        return false;
    }

    /**
     * Find all current matches on the board
     * Returns list of unique entity IDs involved in matches
     */
    findMatches(world: WorldState): Set<number> {
        const matched = new Set<number>();

        // Helper check: Can this tile participate in a match?
        const canMatch = (id: number): boolean => {
            if (id === -1) return false;
            const mod = this.getMod(id);
            // ASH and STONE cannot match
            return mod !== TileMod.ASH && mod !== TileMod.STONE;
        }

        // Horizontal
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width - 2; c++) {
                const id1 = this.grid[r][c];
                const id2 = this.grid[r][c + 1];
                const id3 = this.grid[r][c + 2];

                if (!canMatch(id1) || !canMatch(id2) || !canMatch(id3)) continue;

                const t1 = SkillAccess.getShapeId(world, id1);
                const t2 = SkillAccess.getShapeId(world, id2);
                const t3 = SkillAccess.getShapeId(world, id3);

                if (t1 === t2 && t2 === t3) {
                    matched.add(id1);
                    matched.add(id2);
                    matched.add(id3);
                }
            }
        }

        // Vertical
        for (let c = 0; c < this.width; c++) {
            for (let r = 0; r < this.height - 2; r++) {
                const id1 = this.grid[r][c];
                const id2 = this.grid[r + 1][c];
                const id3 = this.grid[r + 2][c];

                if (!canMatch(id1) || !canMatch(id2) || !canMatch(id3)) continue;

                const t1 = SkillAccess.getShapeId(world, id1);
                const t2 = SkillAccess.getShapeId(world, id2);
                const t3 = SkillAccess.getShapeId(world, id3);

                if (t1 === t2 && t2 === t3) {
                    matched.add(id1);
                    matched.add(id2);
                    matched.add(id3);
                }
            }
        }

        return matched;
    }

    /**
     * Resolve matches: Remove entities and update grid
     */
    resolveMatches(world: WorldState, entityManager: EntityManager, matches: Set<number>, cycleSystem: CycleSystem): { isCycleHit: boolean, multiplier: number } {
        if (matches.size === 0) return { isCycleHit: false, multiplier: 1 };

        let bestMultiplier = 1;
        let anyCycleHit = false;

        // Group matches by type to check cycle
        const matchesByType = new Map<ElementType, number>();
        matches.forEach(id => {
            const type = SkillAccess.getShapeId(world, id);
            matchesByType.set(type, (matchesByType.get(type) || 0) + 1);
        });

        // Trigger Cycle Check for each matching type found
        matchesByType.forEach((count, type) => {
            const result = cycleSystem.checkMatch(type);
            if (result.isCycleHit) {
                anyCycleHit = true;
                if (result.multiplier > bestMultiplier) {
                    bestMultiplier = result.multiplier;
                }
            }
        });

        // Remove entities
        matches.forEach(id => {
            for (let r = 0; r < this.height; r++) {
                for (let c = 0; c < this.width; c++) {
                    if (this.grid[r][c] === id) {
                        this.grid[r][c] = -1;
                    }
                }
            }
            StateAccess.deactivate(world, id);
            entityManager.removeEntity(id);
            this.tileMods.delete(id);
        });

        return { isCycleHit: anyCycleHit, multiplier: bestMultiplier };
    }

    /**
     * Apply Gravity: Make tiles fall into empty spaces
     * Returns true if any movement occurred
     */
    applyGravity(world: WorldState, entityManager: EntityManager, spawnVisual: (id: number, color: number, shape: number) => void): boolean {
        let moved = false;

        // Loop columns
        for (let c = 0; c < this.width; c++) {
            let writeRow = this.height - 1;

            // 1. Shift existing tiles down
            for (let r = this.height - 1; r >= 0; r--) {
                const id = this.grid[r][c];

                // If STONE, it acts as a floor. It stays where it is.
                // Reset writeRow to be above the stone.
                if (id !== -1 && this.getMod(id) === TileMod.STONE) {
                    writeRow = r - 1;
                    continue;
                }

                if (id !== -1) {
                    if (r !== writeRow) {
                        this.grid[writeRow][c] = this.grid[r][c];
                        this.grid[r][c] = -1;

                        const movedId = this.grid[writeRow][c];
                        const x = this.getColumnX(c);
                        const y = this.getRowY(writeRow);
                        TransformAccess.set(world, movedId, x, y, 0, 1, 0, 0, 0);

                        moved = true;
                    }
                    writeRow--;
                }
            }

            // 2. Refill top
            while (writeRow >= 0) {
                this.spawnTile(world, entityManager, writeRow, c, spawnVisual);
                writeRow--;
                moved = true;
            }
        }

        return moved;
    }

    /**
     * Convert World (x, y) to Grid (r, c)
     * Returns [-1, -1] if out of bounds
     */
    getGridCoordinates(worldX: number, worldY: number): [number, number] {
        const c = Math.round((worldX - this.startX) / this.tileSize);
        const r = Math.round((worldY - this.startY) / this.tileSize);

        if (c >= 0 && c < this.width && r >= 0 && r < this.height) {
            return [r, c];
        }
        return [-1, -1];
    }

    /**
     * Try to swap two tiles.
     * Returns true if swap was successful (resulted in match).
     */
    trySwap(world: WorldState, entityManager: EntityManager, r1: number, c1: number, r2: number, c2: number): boolean {
        const dr = Math.abs(r1 - r2);
        const dc = Math.abs(c1 - c2);
        if (dr + dc !== 1) return false;

        // Cannot swap non-interactive tiles (Ash, Stone, Frozen?)
        // V2: "Ash tiles cannot be matched", implying cannot move.
        // Let's assume Ash is "dead weight" but movable? V2 says "Ash tiles cannot be matched (black, charred)".
        // Usually blockers are immovable. Let's make STONE immovable, ASH movable but no match.
        // Wait, Boss 2: "Stones spread... obstacles (cannot be matched)". 
        // Let's block swapping for Stone. Ash is debatable, but let's allow swap for now so you can move it out of the way?
        // Actually, cleaner if modded tiles are "stuck" or special. For now, block swap if STONE.
        const id1 = this.grid[r1][c1];
        const id2 = this.grid[r2][c2];

        if (this.getMod(id1) === TileMod.STONE || this.getMod(id2) === TileMod.STONE) return false;

        // ASH cannot match, so if you swap ASH into a match, it won't trigger anyway (handled by findMatches).
        // BUT if swap results in NO match, it reverts. So swapping Ash might always revert unless it moves a valid tile into a match.

        this.performSwap(world, r1, c1, r2, c2);

        const matches = this.findMatches(world);
        if (matches.size > 0) {
            return true;
        } else {
            this.performSwap(world, r1, c1, r2, c2); // Swap back
            return false;
        }
    }

    private performSwap(world: WorldState, r1: number, c1: number, r2: number, c2: number): void {
        const id1 = this.grid[r1][c1];
        const id2 = this.grid[r2][c2];

        this.grid[r1][c1] = id2;
        this.grid[r2][c2] = id1;

        if (id1 !== -1) {
            TransformAccess.set(world, id1, this.getColumnX(c2), this.getRowY(r2), 0, 1, 0, 0, 0);
        }
        if (id2 !== -1) {
            TransformAccess.set(world, id2, this.getColumnX(c1), this.getRowY(r1), 0, 1, 0, 0, 0);
        }
    }

    // Helpers
    private getColumnX(c: number): number {
        return this.startX + c * this.tileSize;
    }

    private getRowY(r: number): number {
        return this.startY + r * this.tileSize;
    }

    private getElementColor(type: ElementType): number {
        switch (type) {
            case ElementType.METAL: return 0xE0E0E0;
            case ElementType.WOOD: return 0x4CAF50;
            case ElementType.WATER: return 0x2196F3;
            case ElementType.FIRE: return 0xF44336;
            case ElementType.EARTH: return 0x795548;
            default: return 0xFFFFFF;
        }
    }

    /** 
     * Get random tile ID - useful for Boss skills
     */
    public getRandomTileId(): number {
        const r = Math.floor(Math.random() * this.height);
        const c = Math.floor(Math.random() * this.width);
        return this.grid[r][c];
    }

    public getWidth(): number { return this.width; }
    public getHeight(): number { return this.height; }
}
