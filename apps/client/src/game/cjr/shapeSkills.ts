import { Player, Bot, GameState, Vector2, Entity } from '../../types';
import { ShapeId, TattooId } from './cjrTypes';
import { StatusFlag } from '../engine/statusFlags';
import { TransformAccess, PhysicsAccess } from '@cjr/engine';
import { getEntityStateBridge } from '../engine/context';
import { getCurrentEngine } from '../engine/context';
import { vfxSystem } from '../vfx/vfxSystem';

export interface ShapeSkillDef {
  name: string;
  cooldown: number;
  description: string;
  execute: (entity: Player | Bot, state: GameState) => void;
}

// EIDOLON-V: Helper to get DOD Position (uses injected world)
const getPos = (e: Entity) => {
  if (e.physicsIndex !== undefined) {
    const world = getCurrentEngine().world;
    return { x: TransformAccess.getX(world, e.physicsIndex), y: TransformAccess.getY(world, e.physicsIndex) };
  }
  return e.position;
};

// EIDOLON-V: Helper to get DOD Velocity (uses injected world)
const getVel = (e: Entity) => {
  if (e.physicsIndex !== undefined) {
    const world = getCurrentEngine().world;
    return { x: PhysicsAccess.getVx(world, e.physicsIndex), y: PhysicsAccess.getVy(world, e.physicsIndex) };
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
      const vel = getVel(entity);

      entity.radius = Math.max(12, entity.radius * 0.98);

      // If velocity is near zero, use facing or default
      let dir = { x: 1, y: 0 };
      const speedSq = vel.x * vel.x + vel.y * vel.y;
      if (speedSq > 0.001) {
        const invMag = 1.0 / Math.sqrt(speedSq);
        dir = { x: vel.x * invMag, y: vel.y * invMag };
      }

      const dashPower = 800;
      // EIDOLON-V: Write back to Physics Store directly (uses injected world)
      if (entity.physicsIndex !== undefined) {
        const world = getCurrentEngine().world;
        PhysicsAccess.setVx(world, entity.physicsIndex, dir.x * dashPower);
        PhysicsAccess.setVy(world, entity.physicsIndex, dir.y * dashPower);
      } else {
        // Fallback: Update entity object for legacy systems
        entity.velocity.x = dir.x * dashPower;
        entity.velocity.y = dir.y * dashPower;
      }

      // Also update PhysicsStore immediately allow subsequent logic to see it this frame?
      // Optional optimization.

      entity.statusTimers.invulnerable = 0.3;
      entity.statusFlags |= StatusFlag.INVULNERABLE;

      // EIDOLON-V: Emit Dash Event (Type 2)
      vfxSystem.emitVFX(state, 2, pos.x, pos.y, 0, entity.id);
    },
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

          if (other.physicsIndex !== undefined) {
            const world = getCurrentEngine().world;
            const curVx = PhysicsAccess.getVx(world, other.physicsIndex);
            const curVy = PhysicsAccess.getVy(world, other.physicsIndex);
            PhysicsAccess.setVx(world, other.physicsIndex, curVx + dir.x * knockbackPower);
            PhysicsAccess.setVy(world, other.physicsIndex, curVy + dir.y * knockbackPower);
          } else {
            // Fallback for legacy systems
            other.velocity.x += dir.x * knockbackPower;
            other.velocity.y += dir.y * knockbackPower;
          }

          if ('currentHealth' in other) {
            getEntityStateBridge().setCurrentHealth(other, other.currentHealth - 10);
          }
        }
      }

      entity.statusFlags |= StatusFlag.SHIELDED;
      entity.statusScalars.commitShield = 2.0;

      // EIDOLON-V: Emit Shockwave Event (Type 3)
      vfxSystem.emitVFX(state, 3, pos.x, pos.y, 0, entity.id);
    },
  },

  triangle: {
    name: 'Piercing Strike',
    cooldown: 4.0,
    description: 'Next attack deals 2.5x damage and ignores 50% defense',
    execute: (entity, state) => {
      const pos = getPos(entity);
      getEntityStateBridge().setDamageMultiplier(entity, 2.5);
      entity.armorPen = Math.min(1.0, entity.armorPen + 0.5);
      entity.statusScalars.speedSurge = 3.0;

      // EIDOLON-V: Emit Pierce Event (Type 4)
      vfxSystem.emitVFX(state, 4, pos.x, pos.y, 0, entity.id);
    },
  },

  hex: {
    name: 'Vortex Pull',
    cooldown: 8.0,
    description: 'Pull nearby pickups for 2s, +30% pickup value',
    execute: (entity, state) => {
      const pos = getPos(entity);
      getEntityStateBridge().setMagnetRadius(entity, 200);
      entity.statusTimers.magnet = 2.0;
      entity.statusMultipliers.pity = 2.0;

      // Physics logic loop handled in engine/index.ts magnet section

      // EIDOLON-V: Emit Vortex Event (Type 5)
      vfxSystem.emitVFX(state, 5, pos.x, pos.y, 0, entity.id);
    },
  },
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
