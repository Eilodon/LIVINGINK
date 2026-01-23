
import {
  SKILL_COOLDOWN_BASE
} from '../../../constants';
import { Player, Bot, ShapeId, Vector2 } from '../../../types';
import { normalize, distance } from '../math';
import { createProjectile } from '../factories';
import { getCurrentEngine } from '../context';

export const applySkill = (
  entity: Player | Bot,
  targetPos?: Vector2,
  data?: any
) => {
  if (entity.skillCooldown > 0) return;

  const type = ('shape' in entity) ? (entity as Player).shape : 'circle';

  switch (type) {
    case 'circle': // Runner: Dash
      performDash(entity);
      break;
    case 'square': // Tank: Bump/Shield
      performBump(entity);
      break;
    case 'triangle': // Assassin: Pierce Dash or Projectile
      performPierce(entity);
      break;
    case 'hex': // Utility: Magnet
      performMagnet(entity);
      break;
  }

  // Set Cooldown
  const cdMult = entity.skillCooldownMultiplier || 1;
  entity.skillCooldown = entity.maxSkillCooldown * cdMult;
};

const performDash = (entity: Player | Bot) => {
  // Immediate velocity Impulse
  // Add 25 units of speed in current direction
  const speed = Math.hypot(entity.velocity.x, entity.velocity.y);
  const boost = 35; // Impulse strength

  if (speed > 0.1) {
    const dirX = entity.velocity.x / speed;
    const dirY = entity.velocity.y / speed;
    entity.velocity.x += dirX * boost;
    entity.velocity.y += dirY * boost;
  }
};

const performBump = (entity: Player | Bot) => {
  // AOE Pushback
  const range = entity.radius * 2.5;
  const force = 50; // Strong push

  const targets = getCurrentEngine().spatialGrid.getNearby(entity);
  targets.forEach(t => {
    if (t === entity) return;
    // Push away logic
    const dx = t.position.x - entity.position.x;
    const dy = t.position.y - entity.position.y;
    const dist = Math.hypot(dx, dy);

    if (dist < range && dist > 0) {
      // Apply Impulse
      // Falloff by distance?
      const factor = 1 - (dist / range);
      const push = force * factor;

      if ('velocity' in t) { // is movable
        const v = t as Player | Bot; // or food
        v.velocity.x += (dx / dist) * push;
        v.velocity.y += (dy / dist) * push;

        // Stun?
      }
    }
  });

  // Visual Ring?
  // vfxManager.createEffect('shockwave', entity.position);
};

const performPierce = (entity: Player | Bot) => {
  // Fire Projectile in direction of aim or movement

  // Determine target position
  let targetPos = { x: entity.position.x + 100, y: entity.position.y }; // Default forward

  if ('targetPosition' in entity && (entity as Player).targetPosition) {
    // Player aim at target
    targetPos = (entity as Player).targetPosition;
  } else {
    // Bot/Moving - aim in velocity direction
    const speed = Math.hypot(entity.velocity.x, entity.velocity.y);
    if (speed > 0.1) {
      targetPos = {
        x: entity.position.x + (entity.velocity.x / speed) * 200,
        y: entity.position.y + (entity.velocity.y / speed) * 200
      };
    }
  }

  const proj = createProjectile(
    entity.id,
    entity.position,
    targetPos,
    30,         // damage
    'sting',    // type
    1.5         // duration
  );

  // Add to game state via return (caller handles)
  // For now, skills system doesn't have state access, so projectile is created but not added
  // TODO: Wire this properly via state reference or event system
};

const performMagnet = (entity: Player | Bot) => {
  // Pulls food
  // We set a flag or duration, handled in Update loop or Physics loop?
  // Or we apply instantaneous pull here?
  // Instant pull is easier.

  const range = 500;
  const pullStrength = 15;

  const nearby = getCurrentEngine().spatialGrid.getNearby(entity);
  nearby.forEach(e => {
    if ('value' in e) { // Food
      const dx = entity.position.x - e.position.x;
      const dy = entity.position.y - e.position.y;
      const dist = Math.hypot(dx, dy);

      if (dist < range) {
        // Pull towards player
        // e.velocity usually 0 for food, gives it a kick
        const food = e as any; // Cast to Food type if compatible
        if (!food.velocity) food.velocity = { x: 0, y: 0 };

        food.velocity.x += (dx / dist) * pullStrength;
        food.velocity.y += (dy / dist) * pullStrength;
      }
    }
  });
};
