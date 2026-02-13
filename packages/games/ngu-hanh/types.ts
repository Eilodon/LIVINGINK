export enum ElementType {
    METAL = 0,
    WOOD = 1,
    WATER = 2,
    FIRE = 3,
    EARTH = 4
}

export enum TileMod {
    NONE = 0,
    ASH = 1,   // Burnt by Fire Phoenix, cannot match
    STONE = 2, // Created by Earth Golem, blocks gravity
    FROZEN = 3,// Created by Water/Ice, requires breaking
    LOCKED = 4 // Metal cage
}
