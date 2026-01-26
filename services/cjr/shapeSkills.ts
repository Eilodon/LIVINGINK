import { Player, Bot, GameState, Vector2 } from '../../types';
import { ShapeId, TattooId } from './cjrTypes';
import { normalize, distance } from '../engine/math';

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
            const dir = entity.velocity.x === 0 && entity.velocity.y === 0
                ? { x: 1, y: 0 }
                : normalize(entity.velocity);

            const dashPower = 800;
            entity.velocity.x = dir.x * dashPower;
            entity.velocity.y = dir.y * dashPower;

            entity.statusEffects.invulnerable = 0.3;

            // EIDOLON-V: Emit Dash Event
            // Format: "dash:x:y:color"
            state.vfxEvents.push(`dash:${entity.position.x}:${entity.position.y}:${entity.color}`);
        }
    },

    square: {
        name: 'Shockwave Bump',
        cooldown: 5.0,
        description: 'Knock back nearby enemies and gain shield',
        execute: (entity, state) => {
            const bumpRadius = entity.radius * 2.5;
            const knockbackPower = 400;

            const nearby = state.engine.spatialGrid.getNearby(entity);
            nearby.forEach((other: any) => {
                if (other.id === entity.id || other.isDead) return;
                if (!('score' in other)) return;

                const dist = distance(entity.position, other.position);
                if (dist < bumpRadius) {
                    const dir = normalize({
                        x: other.position.x - entity.position.x,
                        y: other.position.y - entity.position.y
                    });
                    other.velocity.x += dir.x * knockbackPower;
                    other.velocity.y += dir.y * knockbackPower;

                    if ('currentHealth' in other) {
                        other.currentHealth -= 10;
                    }
                }
            });

            entity.statusEffects.shielded = true;
            entity.statusEffects.commitShield = 2.0;

            // EIDOLON-V: Emit Shockwave Event
            state.vfxEvents.push(`shockwave:${entity.position.x}:${entity.position.y}:#4a9eff`);
        }
    },

    triangle: {
        name: 'Piercing Strike',
        cooldown: 4.0,
        description: 'Next attack deals 2.5x damage and ignores 50% defense',
        execute: (entity, state) => {
            entity.statusEffects.damageBoost = 2.5;
            entity.armorPen = Math.min(1.0, entity.armorPen + 0.5);
            entity.statusEffects.speedSurge = 3.0;

            // EIDOLON-V: Emit Pierce Event (Sparks)
            state.vfxEvents.push(`pierce:${entity.position.x}:${entity.position.y}:#ff3333`);
        }
    },

    hex: {
        name: 'Vortex Pull',
        cooldown: 8.0,
        description: 'Pull nearby pickups for 2s, +30% pickup value',
        execute: (entity, state) => {
            entity.magneticFieldRadius = 200;
            entity.statusEffects.magnetTimer = 2.0;
            entity.statusEffects.pityBoost = 2.0;

            // Physics logic loop handled in engine/index.ts magnet section

            // EIDOLON-V: Emit Vortex Event
            state.vfxEvents.push(`vortex:${entity.position.x}:${entity.position.y}:#9b59b6`);
        }
    }
};

export const executeShapeSkill = (entity: Player | Bot, state: GameState): boolean => {
    if (entity.skillCooldown > 0) return false;
    const skill = SHAPE_SKILLS[entity.shape];
    if (!skill) return false;

    skill.execute(entity, state);

    if ('tattoos' in entity && entity.tattoos.includes(TattooId.Overdrive)) {
        entity.statusEffects.overdriveTimer = 3.0;
    }
    entity.skillCooldown = skill.cooldown * (entity.skillCooldownMultiplier || 1);
    return true;
};

export const getShapeSkillInfo = (shape: ShapeId): ShapeSkillDef | null => {
    return SHAPE_SKILLS[shape] || null;
};
