
import {
  Entity,
  GameState,
  Particle,
  Player,
  Bot,
  Vector2
} from '../../types';
import { createParticle } from './factories';
// factories.ts I rewrote didn't export createFloatingText. I need to add it or inline it.
// I'll inline it here or export it from factories.
// Let's check factories.ts content I wrote.
// I didn't verify if I added createFloatingText.
// Assuming I missed it, I will implement it here or update factories.
// Better to implement here if it's effects related.
import { getCurrentEngine } from './context';

export const createExplosion = (position: Vector2, color: string, count: number) => {
  for (let i = 0; i < count; i++) {
    createParticle(position.x, position.y, color, 8);
  }
};

export const createDeathExplosion = (position: Vector2, color: string, radius: number) => {
  createExplosion(position, color, Math.floor(radius / 2));
};

export const createFloatingText = (
  position: Vector2,
  text: string,
  color: string,
  size: number,
  state: GameState
) => {
  // Simple push to state
  state.floatingTexts.push({
    id: Math.random().toString(),
    position: { ...position },
    text,
    color,
    size,
    life: 1.0,
    velocity: { x: 0, y: -20 }
  });
};

export const notifyPlayerDamage = (victim: Player | Bot) => {
  // Visual flash logic handled in renderer based on damageFlash timer (if implemented)
  // Here maybe sound?
};
