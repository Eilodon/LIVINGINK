import { FACTION_CONFIG } from '../../constants';
import { Bot, Faction, FloatingText, Particle, Player, Vector2 } from '../../types';
import { audioEngine } from '../audio/AudioEngine';
import { vfxManager } from '../vfx/VFXManager';
import { triggerHaptic } from '../haptics';
import { createParticle } from './factories';
import { randomRange } from './math';

export const createFloatingText = (pos: Vector2, text: string, color: string, size: number = 20): FloatingText => ({
  id: Math.random().toString(),
  position: { x: pos.x, y: pos.y - 20 },
  text,
  color,
  size,
  life: 1.0,
  velocity: { x: randomRange(-1, 1), y: -3 },
});

export const notifyPlayerDamage = (state: { player: Player }, position: Vector2, amount: number) => {
  if (amount <= 0) return;
  audioEngine.playDamage(amount);
  vfxManager.triggerDamageTaken(position, amount, 'unknown');
  triggerHaptic('light');
};

export const applyDamageFlash = (target: Player | Bot, amount: number) => {
  if (amount <= 0) return;
  const intensity = Math.min(1, amount / 30);
  target.statusEffects.damageFlash = Math.max(target.statusEffects.damageFlash, intensity);
};

export const createRingParticle = (x: number, y: number, color: string, radius: number, life: number, lineWidth: number = 3) => {
  const p = createParticle(x, y, color, 0);
  p.velocity.x = 0;
  p.velocity.y = 0;
  p.radius = radius;
  p.life = life;
  p.maxLife = life;
  p.style = 'ring';
  p.lineWidth = lineWidth;
  return p;
};

export const createLineParticle = (
  x: number,
  y: number,
  color: string,
  length: number,
  angle: number,
  life: number,
  lineWidth: number = 2
) => {
  const p = createParticle(x, y, color, 0);
  p.velocity.x = 0;
  p.velocity.y = 0;
  p.radius = 2;
  p.life = life;
  p.maxLife = life;
  p.style = 'line';
  p.lineLength = length;
  p.lineWidth = lineWidth;
  p.angle = angle;
  return p;
};

export const createDeathExplosion = (entity: Player | Bot, state: { particles: Particle[] }) => {
  const config = FACTION_CONFIG[entity.faction];
  const baseCount = Math.min(60, Math.max(18, Math.floor(entity.radius * 0.8)));
  const baseSpeed = Math.min(14, 4 + entity.radius * 0.15);

  for (let i = 0; i < baseCount; i++) {
    const p = createParticle(entity.position.x, entity.position.y, config.color, baseSpeed);
    p.radius = Math.max(2, entity.radius * 0.08);
    p.life = 0.8 + Math.random() * 0.5;
    p.maxLife = p.life;
    state.particles.push(p);
  }

  if (entity.faction === Faction.Fire) {
    for (let i = 0; i < 10; i++) {
      const p = createParticle(entity.position.x, entity.position.y, '#fdba74', baseSpeed + 3);
      p.radius = Math.max(3, entity.radius * 0.12);
      p.life = 0.7 + Math.random() * 0.4;
      p.maxLife = p.life;
      state.particles.push(p);
    }
  } else if (entity.faction === Faction.Earth) {
    for (let i = 0; i < 12; i++) {
      const p = createParticle(entity.position.x, entity.position.y, '#92400e', baseSpeed - 2);
      p.radius = Math.max(3, entity.radius * 0.1);
      p.life = 1.0 + Math.random() * 0.4;
      p.maxLife = p.life;
      state.particles.push(p);
    }
  } else if (entity.faction === Faction.Metal) {
    for (let i = 0; i < 8; i++) {
      const p = createParticle(entity.position.x, entity.position.y, '#3b82f6', baseSpeed + 2);
      p.radius = Math.max(2, entity.radius * 0.07);
      p.life = 0.7 + Math.random() * 0.3;
      p.maxLife = p.life;
      state.particles.push(p);
    }
  } else if (entity.faction === Faction.Water) {
    for (let i = 0; i < 12; i++) {
      const p = createParticle(entity.position.x, entity.position.y, '#bae6fd', baseSpeed);
      p.velocity.y -= 2 + Math.random() * 2;
      p.radius = Math.max(2, entity.radius * 0.09);
      p.life = 0.9 + Math.random() * 0.4;
      p.maxLife = p.life;
      state.particles.push(p);
    }
  } else if (entity.faction === Faction.Wood) {
    for (let i = 0; i < 12; i++) {
      const p = createParticle(entity.position.x, entity.position.y, '#86efac', baseSpeed - 1);
      p.radius = Math.max(2, entity.radius * 0.08);
      p.life = 0.9 + Math.random() * 0.5;
      p.maxLife = p.life;
      state.particles.push(p);
    }
  }
};
