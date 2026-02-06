import { MAX_ENTITIES } from '@cjr/engine';

/**
 * EIDOLON-V: Generational Index Pattern
 * Prevents ABA problem when entity IDs are reused.
 * Stale references can be detected by comparing generation.
 */
export interface EntityHandle {
  index: number;
  generation: number;
}

export class EntityManager {
  private static instance: EntityManager;

  // Free list using a simple stack array
  private freeIndices: Int32Array;
  private freeHead: number; // pointer to top of stack

  // EIDOLON-V: Generation counter per slot (ABA protection)
  private generations: Uint16Array;

  public count: number = 0;

  private constructor() {
    this.freeIndices = new Int32Array(MAX_ENTITIES);
    this.generations = new Uint16Array(MAX_ENTITIES); // Init to 0
    this.freeHead = 0;

    // Reverse init so we pop 0 first: [MAX-1, ... 1, 0]
    for (let i = 0; i < MAX_ENTITIES; i++) {
      this.freeIndices[i] = MAX_ENTITIES - 1 - i;
    }
    this.freeHead = MAX_ENTITIES;
  }

  public static getInstance(): EntityManager {
    if (!EntityManager.instance) {
      EntityManager.instance = new EntityManager();
    }
    return EntityManager.instance;
  }

  public createEntity(): number {
    if (this.freeHead <= 0) {
      console.warn('EntityManager: Max entities reached!');
      return -1;
    }

    const index = this.freeIndices[--this.freeHead];
    this.count++;
    return index;
  }

  /**
   * EIDOLON-V: Create entity with generational handle
   * Use this for systems that need to detect stale references
   */
  public createEntityHandle(): EntityHandle | null {
    if (this.freeHead <= 0) {
      console.warn('EntityManager: Max entities reached!');
      return null;
    }

    const index = this.freeIndices[--this.freeHead];
    this.count++;
    return { index, generation: this.generations[index] };
  }

  public removeEntity(id: number): void {
    if (this.count <= 0) return;
    if (id < 0 || id >= MAX_ENTITIES) return;

    // EIDOLON-V: Increment generation on removal (ABA protection)
    this.generations[id]++;

    this.freeIndices[this.freeHead++] = id;
    this.count--;
  }

  /**
   * EIDOLON-V: Check if entity handle is still valid
   * Returns false if entity was recycled since handle was created
   */
  public isValid(handle: EntityHandle): boolean {
    if (handle.index < 0 || handle.index >= MAX_ENTITIES) return false;
    return this.generations[handle.index] === handle.generation;
  }

  /**
   * Get current generation for an entity index
   */
  public getGeneration(index: number): number {
    return this.generations[index];
  }

  public reset(): void {
    this.count = 0;
    this.freeHead = MAX_ENTITIES;
    for (let i = 0; i < MAX_ENTITIES; i++) {
      this.freeIndices[i] = MAX_ENTITIES - 1 - i;
    }
    // Note: generations are NOT reset - stale handles should still be invalid
  }
}

export const entityManager = EntityManager.getInstance();

