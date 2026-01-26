
import {
  FRICTION_BASE,
  MAX_SPEED_BASE,
  MAX_ENTITY_RADIUS,
} from '../../../constants';
import { Entity, Player, Bot, SizeTier } from '../../../types';
import { PhysicsWorld } from '../PhysicsWorld';
import { fastMath } from '../../math/FastMath'; // EIDOLON-V FIX: Import FastMath

/**
 * DOD PHYSICS UPDATE (The Purge)
 * Iterates over Float32Arrays for maximum cache locality.
 */
export const updatePhysicsWorld = (world: PhysicsWorld, dt: number) => {
  const count = world.capacity;
  const frictionBase = Math.pow(FRICTION_BASE, dt * 60);

  // 1. Integration Loop (SIMD-friendly if JIT optimizes)
  for (let i = 0; i < count; i++) {
    if ((world.flags[i] & 1) === 0) continue; // Inactive

    const px = i * 2;
    const py = i * 2 + 1;

    // Friction
    world.velocities[px] *= frictionBase;
    world.velocities[py] *= frictionBase;

    // Position Integration
    // Note: Using a scaler of 10 matches legacy logic
    world.positions[px] += world.velocities[px] * dt * 10;
    world.positions[py] += world.velocities[py] * dt * 10;

    // Map Constraints (Circle)
    // Hardcoded radius for now, should be passed in
    const MAP_R = 2500;
    const r2 = world.positions[px] * world.positions[px] + world.positions[py] * world.positions[py];
    const myR = world.radii[i];

    // Simple Boundary Check
    // EIDOLON-V FIX: Use squared distance comparison (no sqrt)
    const MAP_R_sq = MAP_R * MAP_R;
    const maxDistSq = (MAP_R - myR) * (MAP_R - myR);
    
    if (r2 > maxDistSq) {
      const angle = Math.atan2(world.positions[py], world.positions[px]);
      const safeR = MAP_R - myR;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);

      world.positions[px] = nx * safeR;
      world.positions[py] = ny * safeR;

      // Bounce
      const dot = world.velocities[px] * nx + world.velocities[py] * ny;
      if (dot > 0) {
        world.velocities[px] -= 1.5 * dot * nx;
        world.velocities[py] -= 1.5 * dot * ny;
      }
    }
  }
};

/**
 * Legacy/Hybrid Bridge:
 * Applies game logic (input forces) to the Entity object.
 * AND syncs it to the PhysicsWorld.
 */
export const integrateEntity = (entity: Player | Bot, dt: number) => {
  // 1. Calculate Mass & Caps (Game Logic)
  const BASE_MASS_RADIUS = 28;
  const mass = Math.max(1, Math.pow(entity.radius / BASE_MASS_RADIUS, 1.5));

  const speedScale = 1 / Math.pow(mass, 0.3);
  const speedMultiplier = (entity.statusEffects?.speedBoost || 1);
  const currentMaxSpeed = MAX_SPEED_BASE * speedScale * speedMultiplier;

  // 2. Input Forces (Assume input handling modified velocity already)
  // Clamp Speed
  // EIDOLON-V FIX: Use squared distance comparison (no sqrt)
  const speedSq = entity.velocity.x * entity.velocity.x + entity.velocity.y * entity.velocity.y;
  const maxSpeedSq = currentMaxSpeed * currentMaxSpeed;
  
  if (speedSq > maxSpeedSq) {
    const speed = fastMath.fastSqrt(speedSq);
    const k = currentMaxSpeed / speed;
    entity.velocity.x *= k;
    entity.velocity.y *= k;
  }

  // 3. Sync TO PhysicsWorld (if available) -> This would be done in batch in index.ts
  // For now, we compute updated velocity here but let PhysicsWorld do the integration.
  // Wait, if PhysicsWorld does integration, we shouldn't modify entity.position here?
  // CORRECT.
  // But for legacy compatibility with the rest of the file (factories etc), 
  // we keep the local update as a fallback if World isn't running?
  // No, we must switch.

  // TEMPORARY: Detailed integration is done in updatePhysicsWorld.
  // Here we just prepare data.

  // EIDOLON-V FIX: Restore movement until ECS is fully active
  entity.position.x += entity.velocity.x * dt * 10; // Scaler 10 matches legacy feel
  entity.position.y += entity.velocity.y * dt * 10;
};

/**
 * Legacy Bridge: Resolves collisions using Entity objects but could rely on World.
 */
export const checkCollisions = (
  entity: Entity,
  others: Entity[],
  onCollide: (other: Entity) => void
) => {
  // Standard pairwise check (Hybrid)
  // In a full DOD system, this would iterate indices.
  // For now, we keep object references for gameplay logic (eating).
  others.forEach(other => {
    if (entity === other) return;
    const dx = entity.position.x - other.position.x;
    const dy = entity.position.y - other.position.y;
    
    // EIDOLON-V FIX: Use squared distance comparison (no sqrt)
    const distSq = dx * dx + dy * dy;
    const minDist = entity.radius + other.radius;
    const minDistSq = minDist * minDist;

    if (distSq < minDistSq) {
      onCollide(other);
      // Soft Push
      if (distSq > 0 && !entity.isDead && !other.isDead && 'score' in other) {
        const dist = fastMath.fastSqrt(distSq);
        const overlap = minDist - dist;
        const push = overlap * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;

        // Approximate mass
        const m1 = entity.radius;
        const m2 = other.radius;
        const r1 = m2 / (m1 + m2);

        // Modify Entity state (will be synced to World next frame)
        entity.position.x += nx * push * r1;
        entity.position.y += ny * push * r1;
        entity.velocity.x += nx * push;
        entity.velocity.y += ny * push;
      }
    }
  });
};

export const constrainToMap = (entity: Entity, radius: number) => {
  // Handled in updatePhysicsWorld, but kept for non-synced entities
  // EIDOLON-V FIX: Use squared distance comparison (no sqrt)
  const distSq = entity.position.x * entity.position.x + entity.position.y * entity.position.y;
  const maxDistSq = (radius - entity.radius) * (radius - entity.radius);
  
  if (distSq > maxDistSq) {
    const dist = fastMath.fastSqrt(distSq);
    const angle = Math.atan2(entity.position.y, entity.position.x);
    entity.position.x = Math.cos(angle) * (radius - entity.radius);
    entity.position.y = Math.sin(angle) * (radius - entity.radius);
  }
};

export const updateTier = (entity: Player | Bot) => {
  const r = entity.radius;
  if (r < 40) entity.tier = SizeTier.Larva;
  else if (r < 70) entity.tier = SizeTier.Juvenile;
  else if (r < 100) entity.tier = SizeTier.Adult;
  else if (r < 130) entity.tier = SizeTier.Elder;
  else entity.tier = SizeTier.AncientKing;
};

export const applyGrowth = (entity: Player | Bot, amount: number) => {
  const currentArea = Math.PI * entity.radius * entity.radius;
  const newArea = currentArea + amount * 25;
  entity.radius = Math.sqrt(newArea / Math.PI);
  if (entity.radius > MAX_ENTITY_RADIUS) entity.radius = MAX_ENTITY_RADIUS;
};
