export enum EntityFlags {
    NONE = 0,
    ACTIVE = 1 << 0,
    PLAYER = 1 << 1,
    BOT = 1 << 2,
    FOOD = 1 << 3,
    PROJECTILE = 1 << 4,
    DEAD = 1 << 5,
    OBSTACLE = 1 << 6, // EIDOLON-V FIX: Was 1 << 5 (same as DEAD) - caused collision/death detection bugs

    // Food Subtypes (High bits) - shifted by 1 to accommodate OBSTACLE fix
    FOOD_PIGMENT = 1 << 7,
    FOOD_CATALYST = 1 << 8,
    FOOD_SHIELD = 1 << 9,
    FOOD_SOLVENT = 1 << 10,
    FOOD_NEUTRAL = 1 << 11,
}

export const MAX_ENTITIES = 4096;
