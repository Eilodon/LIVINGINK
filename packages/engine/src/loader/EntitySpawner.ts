/**
 * @eidolon/engine - EntitySpawner
 *
 * Spawns entities into DOD stores based on templates and level config.
 * Bridges high-level entity concepts to low-level DOD storage.
 */

import { MAX_ENTITIES, STRIDES } from '../generated/WorldState.js';
import {
    TransformAccess,
    PhysicsAccess,
    StatsAccess,
    StateAccess,
    SkillAccess,
    InputAccess,
    EntityFlags,
} from '../generated/ComponentAccessors.js';
import type { WorldState } from '../generated/WorldState.js';
import { PLAYER_START_RADIUS } from '../config/constants.js';
import type { EntityTemplate } from './BlueprintLoader.js';

/**
 * Context for spawning entities
 */
export interface SpawnContext {
    /** Current game time */
    gameTime: number;
    /** Callback when entity spawns */
    onSpawn?: (_entityId: number, _type: string) => void;
}

/**
 * Options for spawning a bot
 */
export interface BotSpawnOptions extends SpawnContext {
    name: string;
    spawnDelay?: number;
    personality?: 'bully' | 'farmer' | 'killer' | 'balanced';
}

/**
 * Options for spawning a boss
 */
export interface BossSpawnOptions extends SpawnContext {
    health: number;
    spawnTime: number;
}

/**
 * EntitySpawner - Creates entities in DOD stores
 *
 * This class manages the creation of entities by:
 * 1. Finding available entity slots
 * 2. Setting appropriate flags
 * 3. Initializing component data
 * 4. Triggering spawn callbacks
 */
export class EntitySpawner {
    private nextEntityId = 0;

    /**
     * Find the next available entity slot
     *
     * @returns Entity ID or -1 if no slots available
     */
    findAvailableSlot(world: WorldState): number {
        // EIDOLON-V AUDIT FIX: Removed deprecated StateStore.flags (throws). Use world.stateFlags directly.
        const stateFlags = world.stateFlags;

        // Try to find an inactive slot
        for (let i = 0; i < MAX_ENTITIES; i++) {
            const idx = (this.nextEntityId + i) % MAX_ENTITIES;
            if ((stateFlags[idx] & EntityFlags.ACTIVE) === 0) {
                this.nextEntityId = (idx + 1) % MAX_ENTITIES;
                return idx;
            }
        }

        return -1; // No available slots
    }

    /**
     * Spawn a bot entity
     *
     * @param options Bot spawn options
     * @returns Entity ID or -1 if failed
     */
    spawnBot(world: WorldState, options: BotSpawnOptions): number {
        const entityId = this.findAvailableSlot(world);
        if (entityId === -1) {
            console.error('[EntitySpawner] No available slots for bot');
            return -1;
        }

        // Set flags
        StateAccess.setFlag(world, entityId, EntityFlags.ACTIVE);
        StateAccess.setFlag(world, entityId, EntityFlags.BOT);

        // Initialize transform (random position in ring 1)
        const pos = this.randomPosInRing(1);
        TransformAccess.set(world, entityId, pos.x, pos.y, 0, 1.0, pos.x, pos.y, 0);

        // Initialize physics
        PhysicsAccess.set(world, entityId, 0, 0, 0, 10, PLAYER_START_RADIUS, 0.5, 0.9);

        // Initialize stats
        StatsAccess.set(world, entityId, 100, 100, 0, 0, 1, 1);

        // Initialize skill cooldown
        SkillAccess.setCooldown(world, entityId, 1.0);

        // Initialize input
        InputAccess.setTargetX(world, entityId, pos.x);
        InputAccess.setTargetY(world, entityId, pos.y);

        // Trigger callback
        options.onSpawn?.(entityId, 'bot');

        return entityId;
    }

    /**
     * Spawn a boss entity
     *
     * @param options Boss spawn options
     * @returns Entity ID or -1 if failed
     */
    spawnBoss(world: WorldState, options: BossSpawnOptions): number {
        const entityId = this.findAvailableSlot(world);
        if (entityId === -1) {
            console.error('[EntitySpawner] No available slots for boss');
            return -1;
        }

        // Set flags
        StateAccess.setFlag(world, entityId, EntityFlags.ACTIVE);
        StateAccess.setFlag(world, entityId, EntityFlags.BOT);
        StateAccess.setFlag(world, entityId, EntityFlags.BOSS);

        // Initialize transform (center position)
        TransformAccess.set(world, entityId, 0, 0, 0, 1.5, 0, 0, 0);

        // Initialize physics (larger radius)
        PhysicsAccess.set(world, entityId, 0, 0, 0, 50, 80, 0.5, 0.9);

        // Initialize stats with boss health
        StatsAccess.set(world, entityId, options.health, options.health, 0, 0, 1, 1);

        // Initialize skill cooldown
        SkillAccess.setCooldown(world, entityId, 2.0);

        // Initialize input
        InputAccess.setTargetX(world, entityId, 0);
        InputAccess.setTargetY(world, entityId, 0);

        // Trigger callback
        options.onSpawn?.(entityId, 'boss');

        return entityId;
    }

    /**
     * Spawn an entity from a template
     *
     * @param template Entity template
     * @param x X position
     * @param y Y position
     * @returns Entity ID or -1 if failed
     */
    spawnFromTemplate(world: WorldState, template: EntityTemplate, x: number, y: number): number {
        const entityId = this.findAvailableSlot(world);
        if (entityId === -1) {
            console.error('[EntitySpawner] No available slots for template entity');
            return -1;
        }

        // Set active flag
        StateAccess.setFlag(world, entityId, EntityFlags.ACTIVE);

        // Set additional flags from tags
        if (template.tags) {
            for (const tag of template.tags) {
                switch (tag) {
                    case 'player':
                        StateAccess.setFlag(world, entityId, EntityFlags.PLAYER);
                        break;
                    case 'bot':
                        StateAccess.setFlag(world, entityId, EntityFlags.BOT);
                        break;
                    case 'boss':
                        StateAccess.setFlag(world, entityId, EntityFlags.BOSS);
                        break;
                    case 'food':
                        StateAccess.setFlag(world, entityId, EntityFlags.FOOD);
                        break;
                    case 'projectile':
                        StateAccess.setFlag(world, entityId, EntityFlags.PROJECTILE);
                        break;
                }
            }
        }

        // Initialize components from template
        if (template.components) {
            // Transform component
            if (template.components.Transform) {
                const t = template.components.Transform;
                TransformAccess.set(
                    world,
                    entityId,
                    x + (t.x || 0),
                    y + (t.y || 0),
                    t.rotation || 0,
                    t.scale || 1.0,
                    x + (t.x || 0),
                    y + (t.y || 0),
                    t.rotation || 0
                );
            } else {
                // Default transform
                TransformAccess.set(world, entityId, x, y, 0, 1.0, x, y, 0);
            }

            // Physics component
            if (template.components.Physics) {
                const p = template.components.Physics;
                PhysicsAccess.set(
                    world,
                    entityId,
                    p.vx || 0,
                    p.vy || 0,
                    0, // vRotation
                    p.mass || 10,
                    p.radius || PLAYER_START_RADIUS,
                    p.restitution || 0.5,
                    p.friction || 0.9
                );
            }

            // Stats component
            if (template.components.Stats) {
                const s = template.components.Stats;
                StatsAccess.set(
                    world,
                    entityId,
                    s.currentHealth || 100,
                    s.maxHealth || 100,
                    s.score || 0,
                    s.matchPercent || 0,
                    s.defense || 1,
                    s.damageMultiplier || 1
                );
            }
        }

        return entityId;
    }

    /**
     * Despawn an entity
     *
     * @param entityId Entity ID to despawn
     */
    despawn(world: WorldState, entityId: number): void {
        if (entityId < 0 || entityId >= MAX_ENTITIES) {
            return;
        }

        // Clear all flags
        world.stateFlags[entityId] = 0;

        // Reset component data
        const transformIdx = entityId * STRIDES.TRANSFORM;
        world.transform.fill(0, transformIdx, transformIdx + STRIDES.TRANSFORM);

        const physicsIdx = entityId * STRIDES.PHYSICS;
        world.physics.fill(0, physicsIdx, physicsIdx + STRIDES.PHYSICS);

        const statsIdx = entityId * STRIDES.STATS;
        world.stats.fill(0, statsIdx, statsIdx + STRIDES.STATS);

        // Clear skill cooldown
        SkillAccess.setCooldown(world, entityId, 0);
    }

    /**
     * Generate random position within a ring
     */
    private randomPosInRing(ring: 1 | 2 | 3): { x: number; y: number } {
        const angle = Math.random() * Math.PI * 2;

        let minR: number;
        let maxR: number;

        if (ring === 1) {
            minR = 1000;
            maxR = 1500;
        } else if (ring === 2) {
            minR = 400;
            maxR = 900;
        } else {
            minR = 50;
            maxR = 350;
        }

        const r = minR + Math.random() * (maxR - minR);

        return {
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
        };
    }
}
