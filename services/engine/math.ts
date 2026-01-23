
import { CENTER_RADIUS, MAP_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from '../../constants';
import { Vector2 } from '../../types';

export const distSq = (v1: Vector2, v2: Vector2) => Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2);

export const distance = (v1: Vector2, v2: Vector2) => Math.sqrt(distSq(v1, v2));

export const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const randomPos = (): Vector2 => {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * (MAP_RADIUS - 200) + 200;
  return {
    x: WORLD_WIDTH / 2 + Math.cos(angle) * r,
    y: WORLD_HEIGHT / 2 + Math.sin(angle) * r,
  };
};

export const randomPosInCenter = (): Vector2 => {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * (CENTER_RADIUS * 0.9);
  return {
    x: WORLD_WIDTH / 2 + Math.cos(angle) * r,
    y: WORLD_HEIGHT / 2 + Math.sin(angle) * r,
  };
};

export const normalize = (v: Vector2): Vector2 => {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
};
