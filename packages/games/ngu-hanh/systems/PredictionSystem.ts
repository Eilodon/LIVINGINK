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
    destructions: number[];
    generations: number[];
    blocked: number[];
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
        const result: PredictionResult = { destructions: [], generations: [], blocked: [] };

        if (selectedTileId === -1) return result;

        const selectedType = SkillAccess.getShapeId(world, selectedTileId) as ElementType;
        const selectedMod = gridSystem.getMod(selectedTileId);

        if (selectedMod === TileMod.ASH || selectedMod === TileMod.STONE) {
            result.blocked.push(selectedTileId);
            return result;
        }

        const width = gridSystem.getWidth();
        const height = gridSystem.getHeight();

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
                    result.destructions.push(id);
                } else if (type === targetGeneration) {
                    result.generations.push(id);
                }
            }
        }

        return result;
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
