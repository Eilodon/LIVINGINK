
// COLOR JELLY RUSH - Domain Types

export type PigmentVec3 = {
    r: number; // 0..1
    g: number; // 0..1
    b: number; // 0..1
};

export type RingId = 1 | 2 | 3;

export type Emotion =
    | 'happy'
    | 'hungry'
    | 'yum'
    | 'greed'
    | 'focus'
    | 'panic'
    | 'despair'
    | 'victory'
    | 'ko';

export type PickupKind =
    | 'pigment'
    | 'neutral'
    | 'solvent'
    | 'catalyst'
    | 'shield'
    | 'candy_vein';

export type ShapeId = 'circle' | 'square' | 'triangle' | 'hex';

export enum TattooId {
    FilterInk = 'FilterInk',
    Overdrive = 'Overdrive',
    DepositShield = 'DepositShield',
    PigmentBomb = 'PigmentBomb',
    PerfectMatch = 'PerfectMatch',
    CatalystSense = 'CatalystSense',
    NeutralMastery = 'NeutralMastery',
    SolventExpert = 'SolventExpert',
    CatalystEcho = 'CatalystEcho',
    PrismGuard = 'PrismGuard',
    InkLeech = 'InkLeech',
    GrimHarvest = 'GrimHarvest'
}

// Server Schema Mirror for StatusEffects (if not already in types.ts)
export interface StatusEffectsCjr {
    speedBoost: number;
    shielded: boolean;
    burning: boolean;
    slowed: boolean;
    invulnerable: number;
    damageBoost: number;
    defenseBoost: number;
    commitShield: number;
    pityBoost: number;
}
