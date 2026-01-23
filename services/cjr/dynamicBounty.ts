/**
 * DYNAMIC BOUNTY SYSTEM - Candy Vein
 * 
 * Rubber-band mechanic to prevent "death zone" feeling in Ring 3.
 * When Ring 3 population drops below threshold, spawns high-value
 * Candy Vein pickups near center to give losing players a comeback chance.
 */

import { RING_RADII } from './cjrConstants';
import { GameState, Food, Player, Bot, PickupKind } from '../../types';
import { createFood } from '../engine/factories';
import { distance } from '../engine/math';

// Configuration
const CANDY_VEIN_CONFIG = {
    // Trigger when Ring3 alive <= 30% of total alive
    TRIGGER_THRESHOLD: 0.30,
    // Minimum time between spawns (seconds)
    SPAWN_COOLDOWN: 15.0,
    // Lifetime of Candy Vein (seconds)
    LIFETIME: 10.0,
    // Spawn radius (near center)
    SPAWN_RADIUS_MIN: RING_RADII.CENTER,
    SPAWN_RADIUS_MAX: RING_RADII.R3_BOUNDARY * 0.6,
    // Visual/Gameplay
    RADIUS: 15, // Larger than normal pickup
    MATCH_BOOST: 0.25, // Direct match% boost
    MASS_BOOST: 25, // Mass value
};

// State tracking
let lastSpawnTime = 0;
let activeCandyVeins: string[] = [];

/**
 * Count alive players in each ring
 */
const countPlayersPerRing = (state: GameState): { ring1: number; ring2: number; ring3: number; total: number } => {
    const counts = { ring1: 0, ring2: 0, ring3: 0, total: 0 };

    const checkEntity = (e: Player | Bot) => {
        if (e.isDead) return;
        counts.total++;
        if (e.ring === 1) counts.ring1++;
        else if (e.ring === 2) counts.ring2++;
        else if (e.ring === 3) counts.ring3++;
    };

    if (state.player && !state.player.isDead) checkEntity(state.player);
    state.bots.forEach(b => checkEntity(b));

    return counts;
};

/**
 * Check if Candy Vein should spawn
 */
const shouldSpawnCandyVein = (state: GameState): boolean => {
    // Check cooldown
    if (state.gameTime - lastSpawnTime < CANDY_VEIN_CONFIG.SPAWN_COOLDOWN) {
        return false;
    }

    // Check if any active Candy Vein still exists
    if (activeCandyVeins.length > 0) {
        // Check if they're still alive
        activeCandyVeins = activeCandyVeins.filter(id =>
            state.food.some(f => f.id === id && !f.isDead)
        );
        if (activeCandyVeins.length > 0) return false;
    }

    // Check population ratio
    const counts = countPlayersPerRing(state);
    if (counts.total === 0) return false;

    const ring3Ratio = counts.ring3 / counts.total;
    return ring3Ratio <= CANDY_VEIN_CONFIG.TRIGGER_THRESHOLD;
};

/**
 * Spawn a Candy Vein pickup
 */
const spawnCandyVein = (state: GameState): Food => {
    const food = createFood();

    // Random position near center (within Ring 3)
    const angle = Math.random() * Math.PI * 2;
    const r = CANDY_VEIN_CONFIG.SPAWN_RADIUS_MIN +
        Math.random() * (CANDY_VEIN_CONFIG.SPAWN_RADIUS_MAX - CANDY_VEIN_CONFIG.SPAWN_RADIUS_MIN);

    food.position.x = Math.cos(angle) * r;
    food.position.y = Math.sin(angle) * r;

    // Configure as Candy Vein
    food.kind = 'candy_vein';
    food.radius = CANDY_VEIN_CONFIG.RADIUS;
    food.value = CANDY_VEIN_CONFIG.MASS_BOOST;

    // Bright, noticeable pigment (gold/rainbow)
    food.pigment = {
        r: 1.0,
        g: 0.85,
        b: 0.0
    };
    food.color = '#ffd700'; // Gold

    // Track lifetime via custom property (or use existing mechanisms)
    // For now, we'll track in activeCandyVeins and check age elsewhere

    return food;
};

/**
 * Apply Candy Vein effect when consumed
 * Called from combat.ts consumePickup
 */
export const applyCandyVeinEffect = (consumer: Player | Bot, food: Food) => {
    // Direct match boost (rubber-band!)
    consumer.matchPercent = Math.min(1.0, consumer.matchPercent + CANDY_VEIN_CONFIG.MATCH_BOOST);

    // Trigger greed emotion
    consumer.emotion = 'greed';

    // Remove from tracking
    activeCandyVeins = activeCandyVeins.filter(id => id !== food.id);
};

/**
 * Main update function - call from game loop
 */
export const updateDynamicBounty = (state: GameState, dt: number) => {
    // Remove expired Candy Veins (check age)
    // Since Food doesn't have spawn time, we'll rely on lifetime tracking
    // Alternative: Add spawnTime to Food or use separate tracking

    // For MVP: Just let them persist until eaten or manually expired
    // Clean up dead ones from tracking
    activeCandyVeins = activeCandyVeins.filter(id =>
        state.food.some(f => f.id === id && !f.isDead)
    );

    // Check spawn condition
    if (shouldSpawnCandyVein(state)) {
        const vein = spawnCandyVein(state);
        state.food.push(vein);
        activeCandyVeins.push(vein.id);
        lastSpawnTime = state.gameTime;

        console.log('[CJR] Candy Vein spawned! Rubber-band activated.');
    }
};

/**
 * Reset state for new game
 */
export const resetDynamicBounty = () => {
    lastSpawnTime = 0;
    activeCandyVeins = [];
};

export { CANDY_VEIN_CONFIG };
