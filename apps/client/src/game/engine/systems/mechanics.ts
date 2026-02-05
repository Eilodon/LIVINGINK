import { MAX_SPEED_BASE, MAX_ENTITY_RADIUS } from '../../../constants';
import { Player, Bot, SizeTier } from '../../../types';
import { PhysicsStore, StatsStore, EntityLookup } from '@cjr/engine';

// Logic ported from legacy physics.ts
export const applyGrowth = (entity: Player | Bot, amount: number) => {
  // Legacy Wrapper
  if (entity.physicsIndex !== undefined) {
    applyGrowthDOD(entity.physicsIndex, amount);
    // Sync back (Optional, for UI)
    const pIdx = entity.physicsIndex * 8;
    entity.radius = PhysicsStore.data[pIdx + 4];
    // Tier update is purely visual/logic, keep locally or move?
    updateTier(entity);
  } else {
    // Fallback for non-DOD entities (if any)
    const currentArea = Math.PI * entity.radius * entity.radius;
    const newArea = currentArea + amount * 25;
    entity.radius = Math.sqrt(newArea / Math.PI);
    if (entity.radius > MAX_ENTITY_RADIUS) entity.radius = MAX_ENTITY_RADIUS;
    updateTier(entity);
  }
};

export const applyGrowthDOD = (id: number, amount: number) => {
  const pIdx = id * 8; // PhysicsStore.STRIDE
  const currentRadius = PhysicsStore.data[pIdx + 4];

  const currentArea = Math.PI * currentRadius * currentRadius;
  const newArea = currentArea + amount * 25; // Magic number from constants
  let newRadius = Math.sqrt(newArea / Math.PI);

  if (newRadius > MAX_ENTITY_RADIUS) newRadius = MAX_ENTITY_RADIUS;

  PhysicsStore.data[pIdx + 4] = newRadius;
  // Update Mass? Mass usually ~ Area or Radius.
  PhysicsStore.data[pIdx + 3] = newRadius; // Simplification: Mass = Radius
};

export const updateTier = (entity: Player | Bot) => {
  const r = entity.radius;
  if (r < 40) entity.tier = SizeTier.Larva;
  else if (r < 70) entity.tier = SizeTier.Juvenile;
  else if (r < 100) entity.tier = SizeTier.Adult;
  else if (r < 130) entity.tier = SizeTier.Elder;
  else entity.tier = SizeTier.AncientKing;
};
