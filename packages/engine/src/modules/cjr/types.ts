/**
 * @cjr/engine - CJR Types
 * Pure type definitions - zero dependencies
 */

export type PigmentVec3 = {
    r: number;
    g: number;
    b: number;
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

export type PickupKind = 'pigment' | 'neutral' | 'solvent' | 'catalyst' | 'shield' | 'candy_vein';

export type ShapeId = 'circle' | 'square' | 'triangle' | 'hex';

export enum TattooId {
    // Legacy / Advanced Tattoos
    FilterInk = 'filter_ink',
    Overdrive = 'overdrive',
    DepositShield = 'deposit_shield',
    PigmentBomb = 'pigment_bomb',
    PerfectMatch = 'perfect_match',
    CatalystSense = 'catalyst_sense',
    NeutralMastery = 'neutral_mastery',
    SolventExpert = 'solvent_expert',
    CatalystEcho = 'catalyst_echo',
    PrismGuard = 'prism_guard',
    InkLeech = 'ink_leech',
    GrimHarvest = 'grim_harvest',

    // Foundation / Prototype Tattoos
    SpeedSurge = 'speed_surge',
    Invulnerable = 'invulnerable',
    Rewind = 'rewind',
    Lightning = 'lightning',
    Chaos = 'chaos',
    KingForm = 'king_form',
    Magnet = 'magnet',
    Dash = 'dash',
    Bump = 'bump',
    Pierce = 'pierce',
}

export enum MutationTier {
    Common = 'common',
    Rare = 'rare',
    Epic = 'epic',
    Legendary = 'legendary',
}
