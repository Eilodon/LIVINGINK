/**
 * EIDOLON-V: Network Transform Buffer
 *
 * PURPOSE: Queues network transform updates, engine consumes at fixed tick.
 * This prevents async network writes from corrupting physics mid-tick.
 *
 * INVARIANT: Network NEVER writes directly to DOD stores.
 * All transforms flow: Network -> Buffer -> Engine Tick -> DOD Stores
 */

import { TransformStore, PhysicsStore } from '@cjr/engine';

interface PendingTransform {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export class NetworkTransformBuffer {
  private static instance: NetworkTransformBuffer;

  // Use Map for O(1) lookup and overwrites (latest wins)
  private pending: Map<number, PendingTransform> = new Map();

  // Pre-allocated temp object for iteration (zero allocation in flush)
  private static readonly EMPTY: PendingTransform = { x: 0, y: 0, vx: 0, vy: 0 };

  private constructor() { }

  static getInstance(): NetworkTransformBuffer {
    if (!NetworkTransformBuffer.instance) {
      NetworkTransformBuffer.instance = new NetworkTransformBuffer();
    }
    return NetworkTransformBuffer.instance;
  }

  /**
   * Queue a transform update (called from network handler, async-safe)
   * If same physicsIndex is queued multiple times, latest wins.
   */
  queue(physicsIndex: number, x: number, y: number, vx: number, vy: number): void {
    // Reuse existing object if present (reduce GC)
    const existing = this.pending.get(physicsIndex);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.vx = vx;
      existing.vy = vy;
    } else {
      this.pending.set(physicsIndex, { x, y, vx, vy });
    }
  }

  /**
   * Flush all pending updates to DOD stores.
   * MUST be called once per physics tick, BEFORE physics simulation.
   */
  flush(): void {
    if (this.pending.size === 0) return;

    const tData = TransformStore.data;
    const pData = PhysicsStore.data;

    this.pending.forEach((data, idx) => {
      const tIdx = idx * 8;
      const pIdx = idx * 8;

      tData[tIdx] = data.x;
      tData[tIdx + 1] = data.y;
      pData[pIdx] = data.vx;
      pData[pIdx + 1] = data.vy;
    });

    this.pending.clear();
  }

  /**
   * Check if there are pending updates
   */
  hasPending(): boolean {
    return this.pending.size > 0;
  }

  /**
   * Get pending update for a specific entity (read-only, for interpolation preview)
   */
  getPending(physicsIndex: number): PendingTransform | undefined {
    return this.pending.get(physicsIndex);
  }

  /**
   * Get count of pending updates (for debugging)
   */
  getPendingCount(): number {
    return this.pending.size;
  }

  /**
   * Clear all pending (used on disconnect/reconnect)
   */
  clear(): void {
    this.pending.clear();
  }
}

export const networkTransformBuffer = NetworkTransformBuffer.getInstance();
