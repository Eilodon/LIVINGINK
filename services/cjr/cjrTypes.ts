// Color as 0..1 RGB vector for smooth mixing
export interface PigmentVec3 {
    r: number;
    g: number;
    b: number;
}

// Curated 12 Tattoos for CJR
export enum TattooId {
    Swift = 'swift',
    ThickSkin = 'thick_skin',
    KillingIntent = 'killing_intent',
    KeenHearing = 'keen_hearing',
    DashBoost = 'dash_boost',
    Lifesteal = 'lifesteal',
    ArmorPierce = 'armor_pierce',
    SecondChance = 'second_chance',
    SpeedSurge = 'speed_surge',
    MagneticField = 'magnetic_field',
    SoulAbsorb = 'soul_absorb',
    Rewind = 'rewind',
    ThunderCall = 'thunder_call',
    KingForm = 'king_form',
    Invulnerable = 'invulnerable',
}

// Ring progression (1 → 2 → 3)
export type RingId = 1 | 2 | 3;

// Jelly emotions - Core visual feedback
export const Emotion = {
    Happy: 'happy',
    Hungry: 'hungry',
    Yum: 'yum',
    Greed: 'greed',
    Focus: 'focus',
    Panic: 'panic',
    Sad: 'sad',
    Angry: 'angry',
    Despair: 'despair',
    Victory: 'victory',
    Win: 'victory', // Alias
    Ko: 'ko',
    Neutral: 'neutral'
} as const;
export type Emotion = typeof Emotion[keyof typeof Emotion];

// Pickup types (formerly Food kind)
export type PickupKind =
    | 'pigment'
    | 'neutral'
    | 'solvent'
    | 'catalyst'
    | 'shield'
    | 'candy_vein';

// 4 playable shapes (MVP)
export const ShapeId = {
    Circle: 'circle',
    Square: 'square',
    Triangle: 'triangle',
    Hex: 'hex'
} as const;
export type ShapeId = typeof ShapeId[keyof typeof ShapeId];

// Alias for cleaner code, future-proof if we diverge from MutationId
// (Removed invalid alias)
