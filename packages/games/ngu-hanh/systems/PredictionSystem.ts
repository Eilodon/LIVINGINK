import { WorldState, SkillAccess, EntityFlags, StateAccess } from '@cjr/engine';
import { ElementType, TileMod } from '../types.js';
import { GridSystem } from './GridSystem.js';
import { CycleSystem } from './CycleSystem.js';

export enum InteractionType {
    NONE = 0,
    DESTRUCTION = 1, // Tương Khắc (User destroys target)
    GENERATION = 2,  // Tương Sinh (User buffs target)
    NEUTRAL = 3,     // No effect
    BLOCKED = 4      // Interaction blocked (Ash/Stone)
}

export interface PredictionResult {
    type: InteractionType;
    affectedTiles: number[]; // IDs of tiles that will visually react
}

export class PredictionSystem {

    /**
     * Predict what happens if player interacts with a specific tile (e.g. Hover/Touch)
     * Note: In Match-3, usually you select a tile to SWAP.
     * So input is: "I am holding Tile A, hovering over Tile B".
     * OR: "I just touched Tile A".
     * 
     * V2 Design: "When player touches a tile... see IMMEDIATELY which tiles will be affected."
     * This implies showing relationships (Sinh/Khac) relative to the touched tile.
     */
    predict(world: WorldState, gridSystem: GridSystem, cycleSystem: CycleSystem, selectedTileId: number): PredictionResult {
        if (selectedTileId === -1) return { type: InteractionType.NONE, affectedTiles: [] };

        const selectedType = SkillAccess.getShapeId(world, selectedTileId) as ElementType;
        const selectedMod = gridSystem.getMod(selectedTileId);

        if (selectedMod === TileMod.ASH || selectedMod === TileMod.STONE) {
            return { type: InteractionType.BLOCKED, affectedTiles: [selectedTileId] };
        }

        const width = gridSystem.getWidth();
        const height = gridSystem.getHeight();
        const affected: number[] = [];
        let interactionType = InteractionType.NEUTRAL;

        // V2 Design Logic: 
        // "Show Tương Khắc (Destruction) targets" -> Who does THIS tile destroy?
        // "Show Tương Sinh (Generation) targets" -> Who does THIS tile generate?

        // Check all tiles on board to highlight relationships
        // Cycle: Water -> Wood -> Fire -> Earth -> Metal -> Water
        // Destruction: Water -X-> Fire -X-> Metal -X-> Wood -X-> Earth -X-> Water
        // Wait, standard Wu Xing Destruction:
        // Water puts out Fire
        // Fire melts Metal
        // Metal chops Wood
        // Wood parts Earth
        // Earth absorbs Water

        const targetDestruction = this.getDestructionTarget(selectedType);
        const targetGeneration = this.getGenerationTarget(selectedType);

        // Scan grid for targets
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const id = gridSystem.getEntityAt(r, c);
                if (id === -1 || id === selectedTileId) continue;

                // Skip inactive/dead/modded
                if (gridSystem.getMod(id) !== TileMod.NONE) continue;

                const type = SkillAccess.getShapeId(world, id) as ElementType;

                if (type === targetDestruction) {
                    affected.push(id);
                    interactionType = InteractionType.DESTRUCTION; // Priority?
                } else if (type === targetGeneration) {
                    affected.push(id);
                    // If we haven't set destruction yet, set generation. 
                    // Usually we might want to show BOTH, but return type is single.
                    // Let's assume Destruction takes precedence for "Danger" feel, or Generation for "Combo".
                    // V2 Design says: "On touch... All Wood tiles crack... All Water tiles shimmer".
                    // It implies showing BOTH.
                    if (interactionType === InteractionType.NEUTRAL) {
                        interactionType = InteractionType.GENERATION;
                    }
                }
            }
        }

        return {
            type: interactionType,
            affectedTiles: affected
        };
    }

    private getDestructionTarget(type: ElementType): ElementType {
        switch (type) {
            case ElementType.WATER: return ElementType.FIRE;
            case ElementType.FIRE: return ElementType.METAL;
            case ElementType.METAL: return ElementType.WOOD;
            case ElementType.WOOD: return ElementType.EARTH;
            case ElementType.EARTH: return ElementType.WATER;
            default: return ElementType.WATER;
        }
    }

    private getGenerationTarget(type: ElementType): ElementType {
        switch (type) {
            case ElementType.WATER: return ElementType.WOOD;
            case ElementType.WOOD: return ElementType.FIRE;
            case ElementType.FIRE: return ElementType.EARTH;
            case ElementType.EARTH: return ElementType.METAL;
            case ElementType.METAL: return ElementType.WATER;
            default: return ElementType.WATER;
        }
    }
}
