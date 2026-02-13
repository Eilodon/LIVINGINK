import { ElementType } from '../types';

export class CycleSystem {
    // Current element required in the cycle to continue the chain
    // Sequence: WATER -> WOOD -> FIRE -> EARTH -> METAL -> WATER
    private currentTarget: ElementType = ElementType.WATER;

    private multiplier: number = 1;
    private chainLength: number = 0;

    /**
     * Check if the matched element continues the cycle.
     * @param type The element type that was matched.
     * @returns The applied multiplier for this match.
     */
    checkMatch(type: ElementType): { multiplier: number, isCycleHit: boolean } {
        if (type === this.currentTarget) {
            // SUCCESS: Cycle continued
            this.chainLength++;
            this.multiplier++; // Simple +1 multiplier per step

            // Advance Cycle
            this.advanceCycle();

            console.log(`[CycleSystem] Chain Hit! Length=${this.chainLength}, Mult=${this.multiplier}x. Next Target: ${ElementType[this.currentTarget]}`);

            return { multiplier: this.multiplier, isCycleHit: true };
        } else {
            // FAILURE: Cycle broken
            // But we don't punish completely, just reset chain
            // If chain was long, maybe give a "pity" small bonus?
            // For MVP: Hard reset.

            const prevMult = this.multiplier;
            this.reset();
            console.log(`[CycleSystem] Chain Broken (Matched ${ElementType[type]}, Needed ${ElementType[this.currentTarget]}). Reset.`);
            return { multiplier: 1, isCycleHit: false };
        }
    }

    private advanceCycle(): void {
        switch (this.currentTarget) {
            case ElementType.WATER: this.currentTarget = ElementType.WOOD; break;
            case ElementType.WOOD: this.currentTarget = ElementType.FIRE; break;
            case ElementType.FIRE: this.currentTarget = ElementType.EARTH; break;
            case ElementType.EARTH: this.currentTarget = ElementType.METAL; break;
            case ElementType.METAL: this.currentTarget = ElementType.WATER; break;
        }
    }

    reset(): void {
        this.multiplier = 1;
        this.chainLength = 0;
        // Optional: Reset target to Water? Or keep current?
        // Design implies specific sequence. Let's reset to Water to start fresh.
        this.currentTarget = ElementType.WATER;
    }

    getCurrentTarget(): ElementType {
        return this.currentTarget;
    }

    getChainLength(): number {
        return this.chainLength;
    }

    getStats(): { target: ElementType, multiplier: number, chainLength: number } {
        return {
            target: this.currentTarget,
            multiplier: this.multiplier,
            chainLength: this.chainLength
        };
    }
}
