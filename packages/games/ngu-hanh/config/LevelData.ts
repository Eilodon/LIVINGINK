
import { TileMod } from '../types';

export interface LevelConfig {
    id: number;
    name: string;
    boss: {
        hp: number;
        damageMultiplier: number; // Boss damage scaling
        skills: string[]; // IDs of enabled skills
    };
    grid: {
        width: number;
        height: number;
        mods: { r: number, c: number, type: TileMod }[]; // Pre-placed mods
    };
    moves: number;
}

export const LEVELS: LevelConfig[] = [
    // --- INTRO ---
    {
        id: 1,
        name: "Training Dummy",
        boss: { hp: 500, damageMultiplier: 0.5, skills: [] },
        grid: { width: 6, height: 6, mods: [] },
        moves: 15
    },
    {
        id: 2,
        name: "First Spark (Ash)",
        boss: { hp: 800, damageMultiplier: 0.8, skills: ['ASH_SPREAD'] },
        grid: { width: 6, height: 6, mods: [] },
        moves: 20
    },
    {
        id: 3,
        name: "Solid Ground (Stone)",
        boss: { hp: 1000, damageMultiplier: 1.0, skills: ['STONE_WALL'] },
        grid: { width: 7, height: 7, mods: [] },
        moves: 20
    },
    {
        id: 4,
        name: "Elemental Flow",
        boss: { hp: 1200, damageMultiplier: 1.0, skills: ['ASH_SPREAD', 'STONE_WALL'] },
        grid: { width: 7, height: 7, mods: [] },
        moves: 25
    },
    {
        id: 5,
        name: "Fire Phoenix (Boss)",
        boss: { hp: 2000, damageMultiplier: 1.5, skills: ['ASH_SPREAD', 'ASH_SPREAD'] }, // Frequent ash
        grid: { width: 8, height: 8, mods: [] },
        moves: 30
    },

    // --- PHASE 2: OBSTACLES ---
    {
        id: 6,
        name: "Ruins",
        boss: { hp: 1500, damageMultiplier: 1.1, skills: [] },
        grid: {
            width: 8, height: 8,
            mods: [
                { r: 3, c: 3, type: TileMod.STONE }, { r: 3, c: 4, type: TileMod.STONE },
                { r: 4, c: 3, type: TileMod.STONE }, { r: 4, c: 4, type: TileMod.STONE }
            ]
        },
        moves: 25
    },
    {
        id: 7,
        name: "Ash Storm",
        boss: { hp: 1600, damageMultiplier: 1.2, skills: ['ASH_SPREAD'] },
        grid: { width: 8, height: 8, mods: [] },
        moves: 25
    },
    {
        id: 8,
        name: "Locked In",
        boss: { hp: 1800, damageMultiplier: 1.2, skills: ['LOCK_TILE'] },
        grid: { width: 8, height: 8, mods: [] },
        moves: 25
    },
    {
        id: 9,
        name: "Corrupted Earth",
        boss: { hp: 2000, damageMultiplier: 1.3, skills: ['STONE_WALL', 'ASH_SPREAD'] },
        grid: { width: 8, height: 8, mods: [] },
        moves: 30
    },
    {
        id: 10,
        name: "Earth Golem (Boss)",
        boss: { hp: 3500, damageMultiplier: 1.8, skills: ['STONE_WALL', 'LOCK_TILE'] },
        grid: { width: 8, height: 8, mods: [] },
        moves: 35
    },

    // --- PHASE 3: COMPLEXITY ---
    { id: 11, name: "Narrow Pass", boss: { hp: 2200, damageMultiplier: 1.2, skills: [] }, grid: { width: 6, height: 8, mods: [] }, moves: 25 },
    { id: 12, name: "Wide Open", boss: { hp: 2500, damageMultiplier: 1.3, skills: ['ASH_SPREAD'] }, grid: { width: 9, height: 6, mods: [] }, moves: 25 },
    { id: 13, name: "Checkered Fate", boss: { hp: 2800, damageMultiplier: 1.4, skills: ['STONE_WALL'] }, grid: { width: 8, height: 8, mods: [] }, moves: 30 },
    { id: 14, name: "Chaos", boss: { hp: 3000, damageMultiplier: 1.5, skills: ['ASH_SPREAD', 'LOCK_TILE'] }, grid: { width: 8, height: 8, mods: [] }, moves: 30 },
    { id: 15, name: "Water Dragon (Boss)", boss: { hp: 5000, damageMultiplier: 2.0, skills: ['LOCK_TILE', 'LOCK_TILE'] }, grid: { width: 8, height: 8, mods: [] }, moves: 40 },

    // --- PHASE 4: MASTERY ---
    { id: 16, name: "Gauntlet I", boss: { hp: 4000, damageMultiplier: 1.6, skills: ['ASH_SPREAD', 'STONE_WALL', 'LOCK_TILE'] }, grid: { width: 8, height: 8, mods: [] }, moves: 35 },
    { id: 17, name: "Gauntlet II", boss: { hp: 4500, damageMultiplier: 1.7, skills: ['ASH_SPREAD'] }, grid: { width: 8, height: 8, mods: [] }, moves: 35 },
    { id: 18, name: "Gauntlet III", boss: { hp: 5000, damageMultiplier: 1.8, skills: ['STONE_WALL'] }, grid: { width: 8, height: 8, mods: [] }, moves: 40 },
    { id: 19, name: "The Void", boss: { hp: 6000, damageMultiplier: 2.0, skills: ['ASH_SPREAD', 'STONE_WALL'] }, grid: { width: 8, height: 8, mods: [] }, moves: 40 },
    { id: 20, name: "GRANDMASTER (Final Boss)", boss: { hp: 10000, damageMultiplier: 3.0, skills: ['ASH_SPREAD', 'STONE_WALL', 'LOCK_TILE'] }, grid: { width: 9, height: 9, mods: [] }, moves: 50 },
];
