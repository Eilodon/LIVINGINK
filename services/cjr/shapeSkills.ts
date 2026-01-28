import { Player, Bot, GameState, Vector2, Entity } from '../../types';
import { ShapeId, TattooId } from './cjrTypes';
import { normalize, distance } from '../engine/math';
import { StatusFlag } from '../engine/statusFlags';
import { TransformStore, PhysicsStore } from '../engine/dod/ComponentStores';

export interface ShapeSkillDef {
    name: string;
    cooldown: number;
    description: string;
    execute: (entity: Player | Bot, state: GameState) => void;
}

// EIDOLON-V: Helper to get DOD Position
const getPos = (e: Entity) => {
    if (e.physicsIndex !== undefined) {
        const idx = e.physicsIndex * 8;
        return { x: TransformStore.data[idx], y: TransformStore.data[idx + 1] };
    }
    return e.position;
};

// EIDOLON-V: Helper to get DOD Velocity
const getVel = (e: Entity) => {
    if (e.physicsIndex !== undefined) {
        const idx = e.physicsIndex * 8;
        return { x: PhysicsStore.data[idx], y: PhysicsStore.data[idx + 1] };
    }
    return e.velocity;
};

export const SHAPE_SKILLS: Record<ShapeId, ShapeSkillDef> = {
    circle: {
        name: 'Jet Dash',
        cooldown: 3.0,
        description: 'Burst forward at 3x speed for 0.5s',
        execute: (entity, state) => {
            const pos = getPos(entity);
            let vel = getVel(entity);

            entity.radius = Math.max(12, entity.radius * 0.98);

            // If velocity is near zero, use facing or default
            let dir = { x: 1, y: 0 };
            const speedSq = vel.x * vel.x + vel.y * vel.y;
            if (speedSq > 0.001) {
                const invMag = 1.0 / Math.sqrt(speedSq);
                dir = { x: vel.x * invMag, y: vel.y * invMag };
            }

            const dashPower = 800;
            // EIDOLON-V: Write back to Physics Store directly if possible, or entity (which syncs next frame? No, immediate sync is better)
            // But we are in Logic Update, which happens AFTER Physics Pull.
            // If we write to Entity, it will be Pushed to Physics next frame.
            // BUT for immediate DASH, we want instant velocity.
            // "Ghost Fire" issue is about reading. Writing to entity.velocity is fine if Pushed correctly.
            // Wait, optimizedEngine.integratePhysics Pushes entity -> World.
            // That happens Phase 1. Logic is Phase 4.
            // So entity.velocity write here will be pushed NEXT FRAME.
            // This is acceptable for Dash. The issue was Spawning at (0,0).
            entity.velocity.x = dir.x * dashPower;
            entity.velocity.y = dir.y * dashPower;

            // Also update PhysicsStore immediately allow subsequent logic to see it this frame?
            // Optional optimization.

            entity.statusTimers.invulnerable = 0.3;
            entity.statusFlags |= StatusFlag.INVULNERABLE;

            // EIDOLON-V: Emit Dash Event (Type 2)
            const { vfxSystem } = require('../vfx/vfxSystem');
            vfxSystem.emitVFX(state, 2, pos.x, pos.y, 0, entity.id);
        }
    },

    square: {
        name: 'Shockwave Bump',
        cooldown: 5.0,
        description: 'Knock back nearby enemies and gain shield',
        execute: (entity, state) => {
            const pos = getPos(entity);
            const bumpRadius = entity.radius * 2.5;
            const knockbackPower = 400;

            const nearby = state.engine.spatialGrid.getNearby(entity);
            const count = nearby.length;
            for (let i = 0; i < count; i++) {
                const other = nearby[i] as any;
                if (other.id === entity.id || other.isDead) continue;
                if (!('score' in other)) continue; // Only Units

                const oPos = getPos(other);
                const dx = oPos.x - pos.x;
                const dy = oPos.y - pos.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < bumpRadius * bumpRadius) {
                    const dist = Math.sqrt(distSq) || 0.001;
                    const dir = { x: dx / dist, y: dy / dist };

                    other.velocity.x += dir.x * knockbackPower;
                    other.velocity.y += dir.y * knockbackPower;

                    if ('currentHealth' in other) {
                        other.currentHealth -= 10;
                    }
                }
            }

            entity.statusFlags |= StatusFlag.SHIELDED;
            entity.statusScalars.commitShield = 2.0;

            // EIDOLON-V: Emit Shockwave Event (Type 3)
            const { vfxSystem } = require('../vfx/vfxSystem');
            vfxSystem.emitVFX(state, 3, pos.x, pos.y, 0, entity.id);
        }
    },

    triangle: {
        name: 'Piercing Strike',
        cooldown: 4.0,
        description: 'Next attack deals 2.5x damage and ignores 50% defense',
        execute: (entity, state) => {
            const pos = getPos(entity);
            entity.statusMultipliers.damage = 2.5;
            entity.armorPen = Math.min(1.0, entity.armorPen + 0.5);
            entity.statusScalars.speedSurge = 3.0;

            // EIDOLON-V: Emit Pierce Event (Type 4)
            const { vfxSystem } = require('../vfx/vfxSystem');
            vfxSystem.emitVFX(state, 4, pos.x, pos.y, 0, entity.id);
        }
    },

    hex: {
        name: 'Vortex Pull',
        cooldown: 8.0,
        description: 'Pull nearby pickups for 2s, +30% pickup value',
        execute: (entity, state) => {
            const pos = getPos(entity);
            entity.magneticFieldRadius = 200;
            entity.statusTimers.magnet = 2.0;
            entity.statusMultipliers.pity = 2.0;

            // Physics logic loop handled in engine/index.ts magnet section

            // EIDOLON-V: Emit Vortex Event (Type 5)
            const { vfxSystem } = require('../vfx/vfxSystem');
            vfxSystem.emitVFX(state, 5, pos.x, pos.y, 0, entity.id);
        }
    }
};

export const executeShapeSkill = (entity: Player | Bot, state: GameState): boolean => {
    if (entity.skillCooldown > 0) return false;
    const skill = SHAPE_SKILLS[entity.shape];
    if (!skill) return false;

    // EIDOLON-V: Execution uses Fresh Data via helpers in skill defs
    skill.execute(entity, state);

    if ('tattoos' in entity && entity.tattoos.includes(TattooId.Overdrive)) {
        entity.statusTimers.overdrive = 3.0;
    }
    entity.skillCooldown = skill.cooldown * (entity.skillCooldownMultiplier || 1);
    return true;
};

export const getShapeSkillInfo = (shape: ShapeId): ShapeSkillDef | null => {
    return SHAPE_SKILLS[shape] || null;
};
