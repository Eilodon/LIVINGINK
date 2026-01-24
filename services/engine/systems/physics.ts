
import {
  FRICTION_BASE,
  MAX_SPEED_BASE,
  MAX_ENTITY_RADIUS,
} from '../../../constants';
import { Entity, Player, Bot, SizeTier, Vector2 } from '../../../types';
import { distance, normalize } from '../math';

// Physics Tuning
const BASE_MASS_RADIUS = 28; // Standard starting radius
const FORCE_SCALAR = 1500; // Tuning force strength
const MIN_SPEED = 0.5;

export const applyPhysics = (entity: Player | Bot, dt: number) => {
  // 1. Calculate Mass (Area-based roughly, or Radius^2)
  // We normalize so starting jelly has mass ~ 1.0
  const mass = Math.max(1, Math.pow(entity.radius / BASE_MASS_RADIUS, 1.5));

  // 2. Apply Friction (Drag)
  // Drag Force = -Velocity * Coeff
  // Heavier objects have more momentum, so friction slows them down effectively less 'quickly' in terms of speed change?
  // Actually a=F/m, so Friction Decel = F_fric / m.
  // Standard friction: vel *= 0.9. This is independent of mass.
  // For "Heavy" feel, we want drag to be consistent.
  // Let's stick to simple damping for now but scale max speed.

  // Update Speed Caps based on Size
  const speedScale = 1 / Math.pow(mass, 0.3); // Slower as you grow
  const speedMultiplier =
    (entity.statusEffects?.speedBoost ?? 1) *
    (entity.statusEffects?.tempSpeedBoost ?? 1) *
    (entity.statusEffects?.slowMultiplier ?? 1);
  const currentMaxSpeed = MAX_SPEED_BASE * speedScale * speedMultiplier;
  const currentAccel = (entity.acceleration || 1.0) * FORCE_SCALAR / mass;

  // 3. Movement Logic (Input applied externally via entity.targetPosition or inputs)
  // For Players, input is usually "Mouse Direction".
  // For Bots, input is "Velocity target".

  // Here we assume velocity is already being modified by Input/AI *before* this, 
  // OR we need to apply forces here based on input.
  // Current Architecture: AI/Input sets Velocity DIRECTLY or sets flags?
  // App.tsx/AI.ts sets Velocity directly in Phase 1.
  // Let's migrate to Force-based.

  // If entity has a "Target Vector" (like mouse pos), we apply force pending that direction.
  if ('targetPosition' in entity) {
    const p = entity as Player;
    if (p.targetPosition) {
      const dx = p.targetPosition.x - p.position.x;
      const dy = p.targetPosition.y - p.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 10) { // Deadzone
        const fx = (dx / dist) * currentAccel;
        const fy = (dy / dist) * currentAccel;

        p.velocity.x += fx * dt;
        p.velocity.y += fy * dt;
      }
    }
  }
  // Bots handled in AI.ts - need to ensure AI sets acceleration or target, not direct velocity to fully respect this.
  // For now, let's assume Velocity is preserved and we just apply drag/clamp.

  // Clamp Velocity
  const speed = Math.hypot(entity.velocity.x, entity.velocity.y);
  if (speed > currentMaxSpeed) {
    const scale = currentMaxSpeed / speed;
    entity.velocity.x *= scale;
    entity.velocity.y *= scale;
  }

  // PERFORMANCE FIX: Frame-rate independent friction
  // Old: velocity *= 0.93 (depends on FPS!)
  // New: Apply friction consistently regardless of frame rate
  const frictionPerSecond = Math.pow(FRICTION_BASE, dt * 60);
  entity.velocity.x *= frictionPerSecond;
  entity.velocity.y *= frictionPerSecond;

  // 4. Update Position
  entity.position.x += entity.velocity.x * dt * 10; // Scaling factor
  entity.position.y += entity.velocity.y * dt * 10;

  // Visual Tier
  updateTier(entity);
};

export const constrainToMap = (entity: Entity, radius: number) => {
  const dist = distance(entity.position, { x: 0, y: 0 });
  if (dist + entity.radius > radius) {
    const angle = Math.atan2(entity.position.y, entity.position.x);
    // Push back exactly to edge
    entity.position.x = Math.cos(angle) * (radius - entity.radius);
    entity.position.y = Math.sin(angle) * (radius - entity.radius);

    // Bounce velocity (Inelastic collision with wall)
    const normal = { x: Math.cos(angle), y: Math.sin(angle) };
    const dot = entity.velocity.x * normal.x + entity.velocity.y * normal.y;

    // Reflect: v' = v - (1 + cor) * (v.n) * n
    // Simple bounce: reverse normal component
    if (dot > 0) { // moving towards wall
      entity.velocity.x -= 2 * dot * normal.x;
      entity.velocity.y -= 2 * dot * normal.y;

      // Dampen
      entity.velocity.x *= 0.5;
      entity.velocity.y *= 0.5;
    }
  }
};

export const checkCollisions = (
  entity: Entity,
  others: Entity[],
  onCollide: (other: Entity) => void
) => {
  others.forEach(other => {
    if (entity === other) return;

    const dx = entity.position.x - other.position.x;
    const dy = entity.position.y - other.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = entity.radius + other.radius;

    if (dist < minDist) {
      // Overlap!
      onCollide(other);

      // Soft Collision Resolution (Push apart)
      // unless one eats the other (handled in onCollide logic)
      // We apply separation force here regardless to prevent stacking
      if (dist > 0 && !other.isDead && !entity.isDead) {
        const overlap = minDist - dist;
        const pushX = (dx / dist) * overlap * 0.5; // Shared displacement
        const pushY = (dy / dist) * overlap * 0.5;

        // Weight by mass ratio?
        // For simplified "Soft" feeling, just push equally or assume similar density
        // If entity is player, we want to feel the bump.

        // Only push if "Solid" (Players/Bots)
        // Food doesn't push back usually
        if ('score' in other && 'score' in entity) {
          const eMass = Math.pow(entity.radius, 2);
          const oMass = Math.pow(other.radius, 2);
          const totalMass = eMass + oMass;

          const eRatio = oMass / totalMass; // Other is heavy -> I move more
          const oRatio = eMass / totalMass; // I am heavy -> Other moves more

          entity.position.x += pushX * eRatio;
          entity.position.y += pushY * eRatio;

          // Apply impulse to velocity too?
          // Simple position correction is often enough for "Squishy"
          // But let's add slight bounce
          entity.velocity.x += (pushX * 2);
          entity.velocity.y += (pushY * 2);
        }
      }
    }
  });
};

export const updateTier = (entity: Player | Bot) => {
  const r = entity.radius;
  if (r < 40) entity.tier = SizeTier.Larva;
  else if (r < 70) entity.tier = SizeTier.Juvenile;
  else if (r < 100) entity.tier = SizeTier.Adult;
  else if (r < 130) entity.tier = SizeTier.Elder;
  else entity.tier = SizeTier.AncientKing;

  // Update visual props or state if needed
};

export const applyGrowth = (entity: Player | Bot, amount: number) => {
  const currentArea = Math.PI * entity.radius * entity.radius;
  const newArea = currentArea + amount * 25; // Tuned scalar for gameplay "Juice"
  entity.radius = Math.sqrt(newArea / Math.PI);
  if (entity.radius > MAX_ENTITY_RADIUS) entity.radius = MAX_ENTITY_RADIUS;
};
