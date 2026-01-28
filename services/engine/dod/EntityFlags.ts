export enum EntityFlags {
    NONE = 0,
    ACTIVE = 1 << 0,
    PLAYER = 1 << 1,
    BOT = 1 << 2,
    PROJECTILE = 1 << 3,
    FOOD = 1 << 4,
    OBSTACLE = 1 << 5,
    DEAD = 1 << 6,
    // Add more as needed
}

export const MAX_ENTITIES = 4096;
