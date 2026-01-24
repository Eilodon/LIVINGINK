
import { Player, Bot, GameState, Vector2 } from '../../types';
import { ShapeId, TattooId } from './cjrTypes';
import { normalize, distance } from '../engine/math';
import { createParticle } from '../engine/factories';

/**
 * SHAPE SKILLS - Balanced Design
 * 
 * Design Philosophy:
 * - Circle (Runner): Mobility/Escape
 * - Square (Tank): Control/Defense
 * - Triangle (Assassin): Burst Damage
 * - Hex (Support): Resource Gathering
 */

export interface ShapeSkillDef {
    name: string;
    cooldown: number;
    description: string;
    execute: (entity: Player | Bot, state: GameState) => void;
}

export const SHAPE_SKILLS: Record<ShapeId, ShapeSkillDef> = {
    circle: {
        name: 'Jet Dash',
        cooldown: 3.0,
        description: 'Burst forward at 3x speed for 0.5s',
        execute: (entity, state) => {
            entity.radius = Math.max(12, entity.radius * 0.98);
            // Calculate dash direction (towards target or current velocity)
            const dir = entity.velocity.x === 0 && entity.velocity.y === 0
                ? { x: 1, y: 0 } // Default forward if stationary
                : normalize(entity.velocity);

            // Apply massive velocity boost
            const dashPower = 800;
            entity.velocity.x = dir.x * dashPower;
            entity.velocity.y = dir.y * dashPower;

            // Brief invulnerability during dash
            entity.statusEffects.invulnerable = 0.3;

            // VFX: Trail particles
            for (let i = 0; i < 10; i++) {
                const p = createParticle(
                    entity.position.x,
                    entity.position.y,
                    entity.color,
                    100
                );
                p.velocity = {
                    x: -dir.x * 100 + (Math.random() - 0.5) * 50,
                    y: -dir.y * 100 + (Math.random() - 0.5) * 50
                };
                p.life = 0.5;
                state.particles.push(p);
            }
        }
    },

    square: {
        name: 'Shockwave Bump',
        cooldown: 5.0,
        description: 'Knock back nearby enemies and gain shield',
        execute: (entity, state) => {
            const bumpRadius = entity.radius * 2.5;
            const knockbackPower = 400;

            // Find nearby entities
            const nearby = state.engine.spatialGrid.getNearby(entity);
            nearby.forEach((other: any) => {
                if (other.id === entity.id || other.isDead) return;
                if (!('score' in other)) return; // Only affect units

                const dist = distance(entity.position, other.position);
                if (dist < bumpRadius) {
                    // Knockback
                    const dir = normalize({
                        x: other.position.x - entity.position.x,
                        y: other.position.y - entity.position.y
                    });
                    other.velocity.x += dir.x * knockbackPower;
                    other.velocity.y += dir.y * knockbackPower;

                    // Small damage
                    if ('currentHealth' in other) {
                        other.currentHealth -= 10;
                    }
                }
            });

            // Grant shield
            entity.statusEffects.shielded = true;
            entity.statusEffects.commitShield = 2.0;

            // VFX: Expanding ring
            for (let i = 0; i < 20; i++) {
                const angle = (i / 20) * Math.PI * 2;
                const p = createParticle(
                    entity.position.x,
                    entity.position.y,
                    '#4a9eff',
                    200
                );
                p.velocity = {
                    x: Math.cos(angle) * 200,
                    y: Math.sin(angle) * 200
                };
                p.life = 0.6;
                state.particles.push(p);
            }
        }
    },

    triangle: {
        name: 'Piercing Strike',
        cooldown: 4.0,
        description: 'Next attack deals 2.5x damage and ignores 50% defense',
        execute: (entity, state) => {
            // Buff next attack
            entity.statusEffects.damageBoost = 2.5;
            entity.armorPen = Math.min(1.0, entity.armorPen + 0.5);

            // Duration: 3 seconds or until hit
            entity.statusEffects.speedSurge = 3.0; // Reuse timer slot

            // VFX: Red glow particles
            for (let i = 0; i < 15; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = entity.radius * 0.8;
                const p = createParticle(
                    entity.position.x + Math.cos(angle) * r,
                    entity.position.y + Math.sin(angle) * r,
                    '#ff3333',
                    50
                );
                p.velocity = {
                    x: Math.cos(angle) * 50,
                    y: Math.sin(angle) * 50
                };
                p.life = 0.8;
                state.particles.push(p);
            }
        }
    },

    hex: {
        name: 'Vortex Pull',
        cooldown: 8.0,
        description: 'Pull nearby pickups for 2s, +30% pickup value',
        execute: (entity, state) => {
            // Activate magnetic field
            entity.magneticFieldRadius = 200;
            entity.statusEffects.magnetTimer = 2.0;

            // Buff pickup value temporarily
            const buffDuration = 2.0;
            entity.statusEffects.pityBoost = buffDuration; // Reuse timer

            // Pull effect (applied in physics loop)
            state.food.forEach(f => {
                if (f.isDead) return;
                const dist = distance(entity.position, f.position);
                if (dist < 200) {
                    const dir = normalize({
                        x: entity.position.x - f.position.x,
                        y: entity.position.y - f.position.y
                    });
                    f.velocity.x += dir.x * 150;
                    f.velocity.y += dir.y * 150;
                }
            });

            // VFX: Spiral particles
            for (let i = 0; i < 30; i++) {
                const angle = (i / 30) * Math.PI * 4; // Double spiral
                const r = 150 - (i / 30) * 100;
                const p = createParticle(
                    entity.position.x + Math.cos(angle) * r,
                    entity.position.y + Math.sin(angle) * r,
                    '#9b59b6',
                    80
                );
                p.velocity = {
                    x: Math.cos(angle) * -80,
                    y: Math.sin(angle) * -80
                };
                p.life = 1.0;
                state.particles.push(p);
            }
        }
    }
};

/**
 * Execute shape skill for entity
 */
export const executeShapeSkill = (entity: Player | Bot, state: GameState): boolean => {
    // Check cooldown
    if (entity.skillCooldown > 0) return false;

    const skill = SHAPE_SKILLS[entity.shape];
    if (!skill) return false;

    // Execute
    skill.execute(entity, state);

    if ('tattoos' in entity && entity.tattoos.includes(TattooId.Overdrive)) {
        entity.statusEffects.overdriveTimer = 3.0;
    }

    // Set cooldown
    entity.skillCooldown = skill.cooldown * (entity.skillCooldownMultiplier || 1);

    return true;
};

/**
 * Get skill info for UI
 */
export const getShapeSkillInfo = (shape: ShapeId): ShapeSkillDef | null => {
    return SHAPE_SKILLS[shape] || null;
};
