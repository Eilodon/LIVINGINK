import { ElementType } from '../types.js';

export class CycleSystem {
    // Current element required in the cycle to continue the chain
    // Sequence: WATER -> WOOD -> FIRE -> EARTH -> METAL -> WATER
    private currentTarget: ElementType = ElementType.WATER;

    private multiplier: number = 1;
    private chainLength: number = 0;

    private avatarStateActivated = false;
    private avatarStateMultiplier = 10;

    /**
     * Check if the matched element continues the cycle.
     * @param type The element type that was matched.
     * @returns The applied multiplier for this match.
     */
    checkMatch(type: ElementType): { multiplier: number, isCycleHit: boolean, isAvatarState: boolean } {
        if (type === this.currentTarget) {
            // SUCCESS: Cycle continued
            this.chainLength++;
            this.multiplier++; // Simple +1 multiplier per step

            // Check for Avatar State (full cycle: 5 elements)
            if (this.chainLength >= 5 && this.currentTarget === ElementType.WATER) {
                this.activateAvatarState();

                // Advance is still needed? Or does avatar state reset/pause it?
                // The prompt says "Massive board clear incoming!".
                // We should probably still advance or reset. 
                // Let's advance to keep the flow if they somehow continue, 
                // but usually board clear resets things.
                // For now, let's just return the state and let the module handle the clear.

                return {
                    multiplier: this.avatarStateMultiplier,
                    isCycleHit: true,
                    isAvatarState: true
                };
            }

            // Advance Cycle
            this.advanceCycle();

            console.log(`[CycleSystem] Chain Hit! Length=${this.chainLength}, Mult=${this.multiplier}x. Next Target: ${ElementType[this.currentTarget]}`);

            return { multiplier: this.multiplier, isCycleHit: true, isAvatarState: false };
        } else {
            // FAILURE: Cycle broken
            // But we don't punish completely, just reset chain
            // If chain was long, maybe give a "pity" small bonus?
            // For MVP: Hard reset.

            const prevMult = this.multiplier;
            this.reset();
            console.log(`[CycleSystem] Chain Broken (Matched ${ElementType[type]}, Needed ${ElementType[this.currentTarget]}). Reset.`);
            return { multiplier: 1, isCycleHit: false, isAvatarState: false };
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
        this.resetAvatarState();
        // Optional: Reset target to Water? Or keep current?
        // Design implies specific sequence. Let's reset to Water to start fresh.
        this.currentTarget = ElementType.WATER;
    }

    activateAvatarState(): void {
        this.avatarStateActivated = true;
        console.log('[CycleSystem] AVATAR STATE ACTIVATED! Massive board clear incoming!');
        // TODO: Trigger global effects in next step
    }

    isAvatarStateActive(): boolean {
        return this.avatarStateActivated;
    }

    resetAvatarState(): void {
        this.avatarStateActivated = false;
    }

    getCurrentTarget(): ElementType {
        return this.currentTarget;
    }

    getChainLength(): number {
        return this.chainLength;
    }

    getStats(): { target: ElementType, multiplier: number, chainLength: number, avatarState: boolean } {
        return {
            target: this.currentTarget,
            multiplier: this.multiplier,
            chainLength: this.chainLength,
            avatarState: this.avatarStateActivated
        };
    }
}
