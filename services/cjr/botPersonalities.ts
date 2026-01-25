import { Bot, Player, GameState, Food } from '../../types';
import { distance } from '../engine/math';
import { RING_RADII } from './cjrConstants';
import { getCurrentSpatialGrid } from '../engine/context';

/**
 * BOT PERSONALITIES - PR15
 * 
 * 4 distinct AI behaviors for variety and challenge:
 * - Farmer: Safe resource gathering, avoids combat
 * - Hunter: Aggressive, chases smaller prey
 * - Bully: Opportunistic, targets weak enemies
 * - Greedy: High-risk/reward, goes for special pickups
 */

export type BotPersonality = 'farmer' | 'hunter' | 'bully' | 'greedy' | 'trickster' | 'rubber';

interface PersonalityBehavior {
    name: string;
    description: string;
    update: (bot: Bot, state: GameState, dt: number) => void;
}

// Utility: Find nearest entity of type
const findNearest = (bot: Bot, entities: any[]): any | null => {
    let nearest: any = null;
    let minDist = Infinity;

    entities.forEach(e => {
        if (e.id === bot.id || e.isDead) return;
        const d = distance(bot.position, e.position);
        if (d < minDist && d < 800) { // Vision range
            minDist = d;
            nearest = e;
        }
    });

    return nearest;
};

// FARMER: Prioritizes food gathering, avoids combat
const farmerBehavior: PersonalityBehavior = {
    name: 'Farmer',
    description: 'Safe player, focuses on eating food and avoiding danger',

    update(bot, state, dt) {
        // 1. Check for nearby threats
        const nearby = getCurrentSpatialGrid().getNearby(bot);
        const threats = nearby.filter((e: any) =>
            'score' in e &&
            e.id !== bot.id &&
            !e.isDead &&
            e.radius > bot.radius * 1.2 // 20% bigger = threat
        );

        // 2. If threatened, flee!
        if (threats.length > 0) {
            const threat = threats[0] as Player | Bot;
            const fleeDir = {
                x: bot.position.x - threat.position.x,
                y: bot.position.y - threat.position.y
            };
            const mag = Math.hypot(fleeDir.x, fleeDir.y) || 0.001;
            bot.velocity.x = (fleeDir.x / mag) * 150;
            bot.velocity.y = (fleeDir.y / mag) * 150;
            bot.aiState = 'flee';
            return;
        }

        // 3. Otherwise, forage for food
        const nearestFood = findNearest(bot, state.food);
        if (nearestFood) {
            const dir = {
                x: nearestFood.position.x - bot.position.x,
                y: nearestFood.position.y - bot.position.y
            };
            const mag = Math.hypot(dir.x, dir.y) || 0.001;
            bot.velocity.x = (dir.x / mag) * 100;
            bot.velocity.y = (dir.y / mag) * 100;
            bot.aiState = 'forage';
            bot.targetEntityId = nearestFood.id;
        } else {
            // Wander
            bot.aiState = 'wander';
        }
    }
};

// HUNTER: Aggressive, chases smaller players
const hunterBehavior: PersonalityBehavior = {
    name: 'Hunter',
    description: 'Aggressive predator, hunts smaller enemies',

    update(bot, state, dt) {
        // 1. Find prey (smaller players/bots)
        const allPlayers = [state.player, ...state.bots].filter(p =>
            p && !p.isDead && p.id !== bot.id
        );

        const prey = allPlayers.filter(p =>
            p.radius < bot.radius * 0.8 && // Must be smaller
            distance(p.position, bot.position) < 1000
        );

        // 2. Chase nearest prey
        if (prey.length > 0) {
            const target = findNearest(bot, prey);
            if (target) {
                const dir = {
                    x: target.position.x - bot.position.x,
                    y: target.position.y - bot.position.y
                };
                const mag = Math.hypot(dir.x, dir.y) || 0.001;
                bot.velocity.x = (dir.x / mag) * 120;
                bot.velocity.y = (dir.y / mag) * 120;
                bot.aiState = 'chase';
                bot.targetEntityId = target.id;
                return;
            }
        }

        // 3. No prey? Eat food to grow
        const nearestFood = findNearest(bot, state.food);
        if (nearestFood) {
            const dir = {
                x: nearestFood.position.x - bot.position.x,
                y: nearestFood.position.y - bot.position.y
            };
            const mag = Math.hypot(dir.x, dir.y) || 0.001;
            bot.velocity.x = (dir.x / mag) * 100;
            bot.velocity.y = (dir.y / mag) * 100;
            bot.aiState = 'forage';
        }
    }
};

// BULLY: Opportunistic, targets low-HP enemies
const bullyBehavior: PersonalityBehavior = {
    name: 'Bully',
    description: 'Opportunist, attacks weakened enemies',

    update(bot, state, dt) {
        // 1. Find weak targets (low HP)
        const allPlayers = [state.player, ...state.bots].filter(p =>
            p && !p.isDead && p.id !== bot.id
        );

        const weakTargets = allPlayers.filter(p =>
            p.currentHealth < p.maxHealth * 0.4 && // < 40% HP
            distance(p.position, bot.position) < 800
        );

        // 2. Attack weak target
        if (weakTargets.length > 0) {
            const target = findNearest(bot, weakTargets);
            if (target) {
                const dir = {
                    x: target.position.x - bot.position.x,
                    y: target.position.y - bot.position.y
                };
                const mag = Math.hypot(dir.x, dir.y) || 0.001;
                bot.velocity.x = (dir.x / mag) * 130;
                bot.velocity.y = (dir.y / mag) * 130;
                bot.aiState = 'chase';
                bot.targetEntityId = target.id;
                return;
            }
        }

        // 3. Otherwise, play it safe like farmer
        farmerBehavior.update(bot, state, dt);
    }
};

// GREEDY: High-risk, beelines for special pickups
const greedyBehavior: PersonalityBehavior = {
    name: 'Greedy',
    description: 'Risk-taker, prioritizes special pickups and Candy Vein',

    update(bot, state, dt) {
        // 1. Check for special pickups (shield, candy_vein, catalyst)
        const specialFood = state.food.filter(f =>
            !f.isDead &&
            f.kind !== 'pigment' &&
            f.kind !== 'neutral' &&
            distance(f.position, bot.position) < 1200
        );

        // 2. Beeline for special pickup (ignore danger!)
        if (specialFood.length > 0) {
            const target = findNearest(bot, specialFood);
            if (target) {
                const dir = {
                    x: target.position.x - bot.position.x,
                    y: target.position.y - bot.position.y
                };
                const mag = Math.hypot(dir.x, dir.y) || 0.001;
                // FAST pursuit
                bot.velocity.x = (dir.x / mag) * 150;
                bot.velocity.y = (dir.y / mag) * 150;
                bot.aiState = 'forage';
                bot.targetEntityId = target.id;
                bot.emotion = 'greed'; // Show greed!
                return;
            }
        }

        // 3. No special pickups? Act like hunter (aggressive)
        hunterBehavior.update(bot, state, dt);
    }
};

// TRICKSTER: Orbits ring boundaries, stirs conflict around waves
const tricksterBehavior: PersonalityBehavior = {
    name: 'Trickster',
    description: 'Circles ring boundaries to lure fights near wave spawns',

    update(bot, state, dt) {
        const ringRadius = bot.ring === 1 ? RING_RADII.R2 : bot.ring === 2 ? RING_RADII.R3 : RING_RADII.CENTER * 1.5;
        const angle = Math.atan2(bot.position.y, bot.position.x);
        const targetAngle = angle + 0.8;
        const target = {
            x: Math.cos(targetAngle) * ringRadius,
            y: Math.sin(targetAngle) * ringRadius
        };
        const dir = {
            x: target.x - bot.position.x,
            y: target.y - bot.position.y
        };
        const mag = Math.hypot(dir.x, dir.y) || 0.001;
        bot.velocity.x = (dir.x / mag) * 120;
        bot.velocity.y = (dir.y / mag) * 120;
        bot.aiState = 'wander';
    }
};

// RUBBER-BAND: Prefers fighting bots to avoid constant player pressure
const rubberBehavior: PersonalityBehavior = {
    name: 'Rubber-Band',
    description: 'Targets other bots more than player, reducing pressure',

    update(bot, state, dt) {
        const bots = state.bots.filter(b => b.id !== bot.id && !b.isDead);
        const targetBot = findNearest(bot, bots);
        if (targetBot) {
            const dir = {
                x: targetBot.position.x - bot.position.x,
                y: targetBot.position.y - bot.position.y
            };
            const mag = Math.hypot(dir.x, dir.y) || 0.001;
            bot.velocity.x = (dir.x / mag) * 120;
            bot.velocity.y = (dir.y / mag) * 120;
            bot.aiState = 'chase';
            bot.targetEntityId = targetBot.id;
            return;
        }

        farmerBehavior.update(bot, state, dt);
    }
};

// Personality registry
const PERSONALITIES: Record<BotPersonality, PersonalityBehavior> = {
    farmer: farmerBehavior,
    hunter: hunterBehavior,
    bully: bullyBehavior,
    greedy: greedyBehavior,
    trickster: tricksterBehavior,
    rubber: rubberBehavior
};

/**
 * Main personality update function
 * Called from AI system
 */
export const updateBotPersonality = (bot: Bot, state: GameState, dt: number) => {
    const personality = bot.personality || 'farmer';
    const behavior = PERSONALITIES[personality];

    if (behavior) {
        behavior.update(bot, state, dt);
    } else {
        // Fallback to farmer
        farmerBehavior.update(bot, state, dt);
    }
};

/**
 * Assign random personality to bot
 */
export const assignRandomPersonality = (bot: Bot) => {
    const personalities: BotPersonality[] = ['farmer', 'hunter', 'bully', 'greedy', 'trickster', 'rubber'];
    const weights = [0.3, 0.2, 0.15, 0.15, 0.1, 0.1];

    const rand = Math.random();
    let cumulative = 0;

    for (let i = 0; i < personalities.length; i++) {
        cumulative += weights[i];
        if (rand < cumulative) {
            bot.personality = personalities[i];
            return;
        }
    }

    bot.personality = 'farmer'; // fallback
};

/**
 * Get personality display info
 */
export const getPersonalityInfo = (personality: BotPersonality) => {
    return PERSONALITIES[personality];
};
