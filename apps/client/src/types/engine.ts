// EIDOLON-V: Type-safe Game Engine Interface
import { Entity, Particle } from './entity';
import { PhysicsWorld } from '../game/engine/PhysicsWorld';

// Define interface for the SpatialGrid adapter used in context.ts
export interface ISpatialGrid {
  clear(): void;
  clearDynamic(): void;
  insert(entity: Entity): void;
  insertStatic(entity: Entity): void;
  removeStatic(entity: Entity): void;
  getNearby(entity: Entity, maxDistance?: number): Entity[];
  getNearbyInto(
    entity: Entity,
    outArray: Entity[],
    indices: number[],
    maxDistance?: number
  ): number;
}

// Define interface for ParticlePool used in context.ts
export interface IParticlePool {
  get(x: number, y: number, color: string, speed: number): Particle;
  release(particle: Particle): void;
}

export interface IGameEngine {
  readonly spatialGrid: ISpatialGrid;
  readonly particlePool: IParticlePool;
  readonly physicsWorld: PhysicsWorld;
}

export interface GameEngineConfig {
  worldWidth: number;
  worldHeight: number;
  cellSize: number;
}
