import { entityManager } from './dod/EntityManager';
import { TransformAccess, PhysicsAccess, StateAccess, EntityFlags, WorldState } from '@cjr/engine';
import { networkTransformBuffer } from '../../network/NetworkTransformBuffer';

export class PhysicsWorld {
  // Adapter properties
  // We don't expose raw Float32Arrays here anymore because of Stride differences.
  // Consumers must use TransformAccess directly or helper methods.

  // ID Mapping (EntityID string -> DOD Index)
  public idToIndex: Map<string, number>;
  public indexToId: Map<number, string>; // Reverse map for collision callbacks?

  public capacity: number;
  private world: WorldState;

  constructor(world: WorldState) {
    this.world = world;
    this.capacity = world.maxEntities;
    this.idToIndex = new Map();
    this.indexToId = new Map();
  }

  addBody(
    id: string,
    x: number,
    y: number,
    radius: number,
    mass: number,
    isSolid: boolean = true
  ): number {
    if (this.idToIndex.has(id)) return this.idToIndex.get(id)!;

    // Allocate DOD ID
    const idx = entityManager.createEntity();
    if (idx === -1) {
      console.error('PhysicsWorld: Max entities reached');
      return -1;
    }

    this.idToIndex.set(id, idx);
    this.indexToId.set(idx, id);

    // Init Data
    TransformAccess.set(this.world, idx, x, y, 0, 1, x, y, 0);
    PhysicsAccess.set(this.world, idx, 0, 0, 0, mass, radius, 0.5, 0.9);

    let flags = EntityFlags.ACTIVE;
    // if (isSolid) flags |= EntityFlags.OBSTACLE; // OBSTACLE not defined in generated flags
    StateAccess.setFlag(this.world, idx, flags);
    // StateAccess in compat.ts uses defaultWorld.
    // I should check Generated StateAccess. 
    // StateAccess generated might be only static Get helpers.
    // Let's assume Generated Accessors have get/set.
    // If setFlag is bitwise, correct. If we want overwrite:
    // this.world.stateFlags[idx] = flags; -> IoC safe.
    this.world.stateFlags[idx] = flags;

    return idx;
  }

  removeBody(id: string) {
    const idx = this.idToIndex.get(id);
    if (idx === undefined) return;

    this.world.stateFlags[idx] = 0; // Inactive
    entityManager.removeEntity(idx);
    this.idToIndex.delete(id);
    this.indexToId.delete(idx);
  }

  // Sync from Network - EIDOLON-V: Now queues to buffer for SSOT compliance
  syncBody(id: string, x: number, y: number, vx: number, vy: number) {
    const idx = this.idToIndex.get(id);
    if (idx !== undefined) {
      // EIDOLON-V FIX: Queue for sync at next tick (prevents mid-tick corruption)
      // Network NEVER writes directly to DOD stores anymore
      networkTransformBuffer.queue(idx, x, y, vx, vy);
    }
  }

  // EIDOLON-V P1-2: Sync using entity index directly (bypasses string lookup)
  // Used by binIdx channel for optimized transforms
  syncBodyByIndex(index: number, x: number, y: number, vx: number, vy: number) {
    // Validate index exists in our mapping (security check)
    if (this.indexToId.has(index)) {
      networkTransformBuffer.queue(index, x, y, vx, vy);
    }
  }

  // Accessors
  getX(id: string): number {
    const idx = this.idToIndex.get(id);
    return idx !== undefined ? TransformAccess.getX(this.world, idx) : 0;
  }

  getY(id: string): number {
    const idx = this.idToIndex.get(id);
    return idx !== undefined ? TransformAccess.getY(this.world, idx) : 0;
  }

  getRadius(id: string): number {
    const idx = this.idToIndex.get(id);
    return idx !== undefined ? PhysicsAccess.getRadius(this.world, idx) : 0;
  }

  getVx(id: string): number {
    const idx = this.idToIndex.get(id);
    return idx !== undefined ? PhysicsAccess.getVx(this.world, idx) : 0;
  }

  getVy(id: string): number {
    const idx = this.idToIndex.get(id);
    return idx !== undefined ? PhysicsAccess.getVy(this.world, idx) : 0;
  }

  // Batch Sync helpers (Legacy support)
  syncBodiesFromBatch(
    entities: {
      id: string;
      physicsIndex?: number;
      position: { x: number; y: number };
      velocity: { x: number; y: number };
    }[]
  ) {
    // This was the "Push" step in OptimizedEngine.
    const tData = this.world.transform;
    const pData = this.world.physics;

    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      let idx = ent.physicsIndex;

      if (idx === undefined) {
        idx = this.idToIndex.get(ent.id);
        // Auto-create body
        if (idx === undefined) {
          const r = (ent as any).radius || 20;
          const mass = 1;
          idx = this.addBody(ent.id, ent.position.x, ent.position.y, r, mass);
        }
        if (idx !== -1) ent.physicsIndex = idx;
      }

      if (idx !== undefined && idx !== -1) {
        // Update Pos/Vel from Object
        TransformAccess.setX(this.world, idx, ent.position.x);
        TransformAccess.setY(this.world, idx, ent.position.y);
        PhysicsAccess.setVx(this.world, idx, ent.velocity.x);
        PhysicsAccess.setVy(this.world, idx, ent.velocity.y);

        // Also update Radius if it changed (e.g. growth)
        if ((ent as any).radius) {
          PhysicsAccess.setRadius(this.world, idx, (ent as any).radius);
        }
      }
    }
  }
}
