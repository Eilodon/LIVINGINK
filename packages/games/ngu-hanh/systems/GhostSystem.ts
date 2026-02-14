import { GridSystem } from './GridSystem.js';

export interface GhostState {
    cells: Map<number, GhostCell>;
    isValid: boolean;
    predictionType: 'SWAP' | 'INTERACTION' | 'NONE';
}

export interface GhostCell {
    idx: number;
    element: number;
    tint: number;
    alpha: number;
    scale: number;
}

export class GhostSystem {
    private ghostState: GhostState = { cells: new Map(), isValid: false, predictionType: 'NONE' };

    public update(gridSystem: GridSystem, cycleSystem: any, hoverR: number, hoverC: number, selectedR: number, selectedC: number): GhostState {
        this.ghostState.cells.clear();
        this.ghostState.isValid = false;
        this.ghostState.predictionType = 'NONE';

        // 1. Check Swap Prediction (Drag or Click-to-Swap)
        if (selectedR !== -1 && selectedC !== -1) {
            // If hovering a neighbor
            const dr = Math.abs(hoverR - selectedR);
            const dc = Math.abs(hoverC - selectedC);
            if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
                this.predictSwap(gridSystem, selectedR, selectedC, hoverR, hoverC);
                this.ghostState.predictionType = 'SWAP';
                return this.ghostState;
            }
        }

        // 2. Check Interaction Prediction (Hover Only)
        if (hoverR !== -1 && hoverC !== -1) {
            const preview = gridSystem.previewInteraction(null, cycleSystem, hoverR, hoverC);
            if (preview.type !== 'none') {
                this.predictInteraction(gridSystem, preview, hoverR, hoverC);
                this.ghostState.predictionType = 'INTERACTION';
            }
        }

        return this.ghostState;
    }

    private predictSwap(grid: GridSystem, r1: number, c1: number, r2: number, c2: number) {
        const idx1 = r1 * grid.getWidth() + c1;
        const idx2 = r2 * grid.getWidth() + c2;

        const cells = grid.getCells();
        const elem1 = cells[idx1 * 2];
        const elem2 = cells[idx2 * 2];

        // Visual Swap: Show elem2 at idx1, elem1 at idx2
        this.setGhost(idx1, elem2, 0.6, 1.0, 0xFFFFFF);
        this.setGhost(idx2, elem1, 0.6, 1.0, 0xFFFFFF);

        this.ghostState.isValid = true;
    }

    private predictInteraction(grid: GridSystem, preview: any, r: number, c: number) {
        // Highlight Central Tile
        const idx = r * grid.getWidth() + c;
        // Keep current element (-1 means use existing visual but overlay tint/scale)
        this.setGhost(idx, -1, 0.8, 1.15, 0xFFFFFF);

        // Highlight Neighbors
        if (preview.affectedTiles) {
            preview.affectedTiles.forEach((t: any) => {
                const tIdx = t.row * grid.getWidth() + t.col;
                const tint = t.type === 'destruction' ? 0xFF6B6B : 0x4ECDC4;
                this.setGhost(tIdx, -1, 0.9, 1.1, tint);
            });
        }
        this.ghostState.isValid = true;
    }


    private setGhost(idx: number, element: number, alpha: number, scale: number, tint: number) {
        this.ghostState.cells.set(idx, { idx, element, alpha, scale, tint });
    }
}
