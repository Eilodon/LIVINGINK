/**
 * @cjr/engine - CJR Types
 * Re-exports from @cjr/shared with engine-specific additions
 */

// =============================================================================
// RE-EXPORT FROM @cjr/shared (Single Source of Truth)
// =============================================================================
export type { PigmentVec3, RingId, Emotion, PickupKind, ShapeId } from '@cjr/shared';
export { TattooId } from '@cjr/shared';

// =============================================================================
// ENGINE-SPECIFIC ADDITIONS (Not in @cjr/shared)
// =============================================================================

export enum MutationTier {
    Common = 'common',
    Rare = 'rare',
    Epic = 'epic',
    Legendary = 'legendary',
}

/**
 * Numeric IDs for TattooId enum values.
 * Used for network serialization to avoid charCodeAt collision.
 * (e.g., PigmentBomb, PerfectMatch, PrismGuard, Pierce all start with 'p')
 */
import { TattooId as SharedTattooId } from '@cjr/shared';

export const TATTOO_NUMERIC_ID: Record<SharedTattooId, number> = {
    [SharedTattooId.FilterInk]: 1,
    [SharedTattooId.Overdrive]: 2,
    [SharedTattooId.DepositShield]: 3,
    [SharedTattooId.PigmentBomb]: 4,
    [SharedTattooId.PerfectMatch]: 5,
    [SharedTattooId.CatalystSense]: 6,
    [SharedTattooId.NeutralMastery]: 7,
    [SharedTattooId.SolventExpert]: 8,
    [SharedTattooId.CatalystEcho]: 9,
    [SharedTattooId.PrismGuard]: 10,
    [SharedTattooId.InkLeech]: 11,
    [SharedTattooId.GrimHarvest]: 12,
    [SharedTattooId.SpeedSurge]: 13,
    [SharedTattooId.Invulnerable]: 14,
    [SharedTattooId.Rewind]: 15,
    [SharedTattooId.Lightning]: 16,
    [SharedTattooId.Chaos]: 17,
    [SharedTattooId.KingForm]: 18,
    [SharedTattooId.Magnet]: 19,
    [SharedTattooId.Dash]: 20,
    [SharedTattooId.Bump]: 21,
    [SharedTattooId.Pierce]: 22,
};

/**
 * Reverse lookup: Numeric ID → TattooId
 */
export const TATTOO_BY_NUMERIC_ID: Record<number, SharedTattooId> = Object.fromEntries(
    Object.entries(TATTOO_NUMERIC_ID).map(([k, v]) => [v, k as SharedTattooId])
) as Record<number, SharedTattooId>;
