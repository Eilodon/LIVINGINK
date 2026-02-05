import { MAX_ENTITIES } from '@cjr/engine';

export class EntityManager {
  private static instance: EntityManager;

  // Free list using a simple stack array
  // We can use Int16Array for indices if < 32k, or plain array
  private freeIndices: Int32Array;
  private freeHead: number; // pointer to top of stack

  public count: number = 0;

  private constructor() {
    this.freeIndices = new Int32Array(MAX_ENTITIES);
    this.freeHead = 0;

    // Initialize free list: 0, 1, 2, ... MAX-1
    // We push them in reverse order so we pop 0 first? Or just simple push.
    // Actually, populating 0 to MAX-1.
    // When we alloc, we take from [freeHead].
    // Default state: freeIndices[i] = i
    for (let i = 0; i < MAX_ENTITIES; i++) {
      this.freeIndices[i] = i;
    }
    this.freeHead = MAX_ENTITIES; // Top of stack is at the end?
    // Let's implement standard stack:
    // Stack grows from 0.
    // Initial state: Stack has all indices.
    // freeHead = MAX_ENTITIES.
    // Pop: return freeIndices[--freeHead]
    // Push: freeIndices[freeHead++] = id

    // Wait, let's verify.
    // If indices are [0, 1, ... MAX-1]
    // Pop() -> index MAX-1? No we want simple IDs first usually.
    // Let's reverse init: [MAX-1, ... 1, 0] at 0..MAX-1
    // Pop() -> 0.
    for (let i = 0; i < MAX_ENTITIES; i++) {
      this.freeIndices[i] = MAX_ENTITIES - 1 - i;
    }
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
      return -1; // Or throw?
    }

    const id = this.freeIndices[--this.freeHead];
    this.count++;
    return id;
  }

  public removeEntity(id: number): void {
    if (this.count <= 0) return;

    // Double free check?
    // Only if we maintain a 'live' bitset, but here we assume caller is correct.
    // Validation is expensive.

    this.freeIndices[this.freeHead++] = id;
    this.count--;
  }

  public reset(): void {
    this.count = 0;
    this.freeHead = MAX_ENTITIES;
    for (let i = 0; i < MAX_ENTITIES; i++) {
      this.freeIndices[i] = MAX_ENTITIES - 1 - i;
    }
  }
}

export const entityManager = EntityManager.getInstance();
