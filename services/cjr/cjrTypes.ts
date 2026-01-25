export type PigmentVec3 = {
    r: number; // 0..1
    g: number; // 0..1
    b: number; // 0..1
};

export type RingId = 0 | 1 | 2 | 3; // 0=Global/Spawn, 1=Outer, 2=Middle, 3=Inner/Core

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

export type ShapeId =
    | 'circle'   // Runner
    | 'square'   // Tank
    | 'triangle' // Assassin
    | 'hex';     // Magnet

export enum TattooId {
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
    GrimHarvest = 'grim_harvest'
}

export interface CJRPlayerState {
    pigment: PigmentVec3;
    targetPigment: PigmentVec3; // The goal color for the current level/ring
    matchPercent: number; // 0..1, similarity to targetPigment
    ring: RingId;
    emotion: Emotion;
    shape: ShapeId;
    tattoos: TattooId[];
}
