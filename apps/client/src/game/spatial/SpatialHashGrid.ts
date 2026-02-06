// EIDOLON ARCHITECT: Zero-Allocation Spatial Hash Grid
// Flat Array Linked List Architecture - Zero GC Pressure

import { fastMath } from '../math/FastMath';
import { Entity } from '../../types';
import { TransformStore, PhysicsStore, EntityLookup } from '@cjr/engine';

// EIDOLON-V P0 FIX: __DEV__ guard for hot path warnings
declare const __DEV__: boolean;
// EIDOLON-V FIX: Proper warn-once implementation
const warnedMessages = new Set<string>();
const warnOnce = (msg: string, data?: unknown) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (warnedMessages.has(msg)) return;
    warnedMessages.add(msg);
    if (data) {
      console.warn(msg, data);
    } else {
      console.warn(msg);
    }
  }
};

export interface SpatialHashConfig {
  worldSize: number;
  cellSize: number;
  maxEntities: number;
  enableDynamicResizing: boolean;
  enableMultiLevel: boolean;
}

export interface SpatialQueryResult {
  indices: number[]; // DOD Indices
  cellCount: number;
  queryTime: number;
}

export class SpatialHashGrid {
  // EIDOLON ARCHITECT: Flat Array Linked List (Zero Allocation)
  private cellHead: Int32Array; // First entity in each cell (-1 if empty)
  private nextEntity: Int32Array; // Next entity in linked list (-1 if end)
  private entityCell: Int32Array; // Track which cell an entity is currently in (-1 if none)
  private staticEntityIndices: Set<number> = new Set();

  private visitMark: Uint32Array;
  private visitEpoch: number = 1;

  private config: SpatialHashConfig;
  private cellCount: number;
  private totalCells: number;
  private worldBounds: { min: number; max: number };

  // Reusable temp arrays (pre-allocated)
  private tempCellArray: number[] = [];
  private staticIndexScratch: number[] = [];

  // Debug stats
  private queryCount: number = 0;
  private totalQueryTime: number = 0;

  constructor(config: Partial<SpatialHashConfig> = {}) {
    this.config = {
      worldSize: 6000,
      cellSize: 150,
      maxEntities: 10000,
      enableDynamicResizing: true,
      enableMultiLevel: false,
      ...config,
    };

    this.cellCount = Math.ceil(this.config.worldSize / this.config.cellSize);
    this.totalCells = this.cellCount * this.cellCount;
    this.worldBounds = {
      min: -this.config.worldSize / 2,
      max: this.config.worldSize / 2,
    };

    // EIDOLON ARCHITECT: Pre-allocate flat arrays
    this.cellHead = new Int32Array(this.totalCells);
    this.nextEntity = new Int32Array(this.config.maxEntities);
    this.entityCell = new Int32Array(this.config.maxEntities); // Track current cell
    this.visitMark = new Uint32Array(this.config.maxEntities);

    // Initialize to -1 (empty/end-of-list sentinel)
    this.cellHead.fill(-1);
    this.nextEntity.fill(-1);
    this.entityCell.fill(-1);
  }

  private hashPosition(x: number, y: number): number {
    const gridX = Math.floor((x + this.worldBounds.max) / this.config.cellSize);
    const gridY = Math.floor((y + this.worldBounds.max) / this.config.cellSize);
    const clampedX = fastMath.clamp(gridX, 0, this.cellCount - 1);
    const clampedY = fastMath.clamp(gridY, 0, this.cellCount - 1);
    return clampedY * this.cellCount + clampedX;
  }

  private getCellsForBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    outCells: number[]
  ): void {
    outCells.length = 0;

    const minCellX = Math.floor((minX + this.worldBounds.max) / this.config.cellSize);
    const maxCellX = Math.floor((maxX + this.worldBounds.max) / this.config.cellSize);
    const minCellY = Math.floor((minY + this.worldBounds.max) / this.config.cellSize);
    const maxCellY = Math.floor((maxY + this.worldBounds.max) / this.config.cellSize);

    const clampedMinX = fastMath.clamp(minCellX, 0, this.cellCount - 1);
    const clampedMaxX = fastMath.clamp(maxCellX, 0, this.cellCount - 1);
    const clampedMinY = fastMath.clamp(minCellY, 0, this.cellCount - 1);
    const clampedMaxY = fastMath.clamp(maxCellY, 0, this.cellCount - 1);

    for (let x = clampedMinX; x <= clampedMaxX; x++) {
      for (let y = clampedMinY; y <= clampedMaxY; y++) {
        outCells.push(y * this.cellCount + x);
      }
    }
  }

  // EIDOLON ARCHITECT: O(1) Insert - SINGLE CELL ONLY (Prevents List Corruption)
  add(entityIndex: number, isStatic: boolean = false): void {
    // Validate entity index
    if (entityIndex < 0 || entityIndex >= this.config.maxEntities) {
      warnOnce('SpatialHashGrid.add: Invalid entity index', {
        entityIndex,
        maxEntities: this.config.maxEntities,
      });
      return;
    }

    // Validate TransformStore bounds
    const tIdx = entityIndex * 8;
    if (tIdx + 1 >= TransformStore.data.length) {
      warnOnce('SpatialHashGrid.add: TransformStore index out of bounds', {
        entityIndex,
        tIdx,
        tDataLength: TransformStore.data.length,
      });
      return;
    }

    // Read entity position
    const x = TransformStore.data[tIdx];
    const y = TransformStore.data[tIdx + 1];

    // Validate position
    if (!isFinite(x) || !isFinite(y)) {
      warnOnce('SpatialHashGrid.add: Invalid entity position', { entityIndex, x, y });
      return;
    }

    // Remove from old cell first if already in grid (prevent duplicates)
    if (this.entityCell[entityIndex] !== -1) {
      this.remove(entityIndex);
    }

    // Determine cell based on CENTER position
    const cellIndex = this.hashPosition(x, y);
    if (cellIndex < 0 || cellIndex >= this.totalCells) {
      warnOnce('SpatialHashGrid.add: Invalid cell index', {
        entityIndex,
        x,
        y,
        cellIndex,
        totalCells: this.totalCells,
      });
      return;
    }

    // Prepend to Linked List for this cell
    this.nextEntity[entityIndex] = this.cellHead[cellIndex];
    this.cellHead[cellIndex] = entityIndex;
    this.entityCell[entityIndex] = cellIndex; // Track cell

    if (isStatic) {
      this.staticEntityIndices.add(entityIndex);
    }
  }

  // EIDOLON ARCHITECT: O(cellCount) Clear
  clear(): void {
    this.cellHead.fill(-1);
    // entityCell and nextEntity don't strictly need clearing if cellHead is -1,
    // but clearing entityCell is safer to prevent logic errors in remove()
    this.entityCell.fill(-1);
    this.staticEntityIndices.clear();
  }

  // Clear only dynamic entities (keep static)
  clearDynamic(): void {
    // 1. Clear all cells
    this.cellHead.fill(-1);

    this.staticIndexScratch.length = 0;
    for (const idx of this.staticEntityIndices) {
      this.staticIndexScratch.push(idx);
    }

    // Clear all entityCell entries
    this.entityCell.fill(-1);

    // 3. Clear nextEntity to prevent dangling references
    // But we need to be careful - we'll rebuild the linked lists
    this.nextEntity.fill(-1);

    // 4. Re-insert Static Entities
    // We must iterate the Set of static entities.
    for (let i = 0; i < this.staticIndexScratch.length; i++) {
      const entityIndex = this.staticIndexScratch[i];
      // Validate entity index before re-adding
      if (entityIndex >= 0 && entityIndex < this.config.maxEntities) {
        // Since clearDynamic is called per frame, valid static entities usually don't move.
        // But if they did, we should re-hash.
        // For safety: treat as fresh add
        this.add(entityIndex, true);
      }
    }

    // Note: This matches the previous logic's intent but is O(Statics) instead of O(Cells)
    // which is usually faster (few statics).
    // The previous implementation tried to avoid re-hashing but was complex.
    // This is cleaner and safer.
  }

  // EIDOLON ARCHITECT: Zero-Allocation Query with Linked List Traversal
  queryRadiusInto(x: number, y: number, radius: number, outResults: number[]): void {
    outResults.length = 0; // Reset output array (no allocation)

    // Validate inputs
    if (!isFinite(x) || !isFinite(y) || !isFinite(radius) || radius < 0) {
      warnOnce('SpatialHashGrid.queryRadiusInto: Invalid input parameters', { x, y, radius });
      return;
    }

    // Get cells to check (writes to tempCellArray - pre-allocated)
    this.getCellsForBounds(x - radius, x + radius, y - radius, y + radius, this.tempCellArray);

    const radiusSq = radius * radius;
    const tData = TransformStore.data;
    const pData = PhysicsStore.data;

    // Safety limit to prevent infinite loops or excessive results
    const MAX_RESULTS = 10000;
    const MAX_ITERATIONS = this.config.maxEntities * 2; // Safety limit for linked list traversal

    // EIDOLON-V AUDIT FIX: Move epoch increment OUTSIDE the cell loop
    // Was incrementing per-cell, which broke cross-cell duplicate detection entirely
    let epoch = (this.visitEpoch + 1) >>> 0;
    if (epoch === 0 || epoch === 0xffffffff) {
      this.visitMark.fill(0);
      epoch = 1;
    }
    this.visitEpoch = epoch;

    // EIDOLON ARCHITECT: Zero-allocation iteration with proper cross-cell dedup
    for (let c = 0; c < this.tempCellArray.length; c++) {
      const cellIndex = this.tempCellArray[c];
      if (cellIndex < 0 || cellIndex >= this.totalCells) continue; // Validate cell index

      // CRITICAL: Traverse linked list (zero allocation)
      let currentEntityIndex = this.cellHead[cellIndex];
      let iterationCount = 0;

      while (
        currentEntityIndex !== -1 &&
        iterationCount < MAX_ITERATIONS &&
        outResults.length < MAX_RESULTS
      ) {
        // EIDOLON-V AUDIT FIX: Validate entity index BEFORE visitMark access (was OOB read)
        if (currentEntityIndex < 0 || currentEntityIndex >= this.config.maxEntities) {
          warnOnce('SpatialHashGrid: Invalid entity index', currentEntityIndex);
          break;
        }

        // Safety check: prevent infinite loops from corrupted linked lists
        // and deduplicate entities spanning multiple cells
        if (this.visitMark[currentEntityIndex] === epoch) {
          // Skip already-visited entity (cross-cell duplicate or cycle)
          const nextIndex = this.nextEntity[currentEntityIndex];
          currentEntityIndex = nextIndex;
          iterationCount++;
          continue;
        }
        this.visitMark[currentEntityIndex] = epoch;

        // DOD Distance Check (direct array access)
        const tIdx = currentEntityIndex * 8;
        if (tIdx + 1 >= tData.length) {
          warnOnce('SpatialHashGrid: TransformStore index out of bounds', {
            currentEntityIndex,
            tIdx,
            tDataLength: tData.length,
          });
          break;
        }

        const ex = tData[tIdx];
        const ey = tData[tIdx + 1];
        const pIdx = currentEntityIndex * 8 + 4;
        if (pIdx >= pData.length) {
          warnOnce('SpatialHashGrid: PhysicsStore index out of bounds', {
            currentEntityIndex,
            pIdx,
            pDataLength: pData.length,
          });
          break;
        }

        const er = pData[pIdx];

        // Validate position and radius
        if (!isFinite(ex) || !isFinite(ey) || !isFinite(er)) {
          warnOnce('SpatialHashGrid: Invalid entity data', { currentEntityIndex, ex, ey, er });
          currentEntityIndex = this.nextEntity[currentEntityIndex];
          iterationCount++;
          continue;
        }

        const dx = x - ex;
        const dy = y - ey;
        const distSq = dx * dx + dy * dy;
        const radSum = radius + er;

        if (distSq <= radSum * radSum) {
          outResults.push(currentEntityIndex);
        }

        // CRITICAL: Advance to next in linked list
        const nextIndex = this.nextEntity[currentEntityIndex];
        if (nextIndex === currentEntityIndex) {
          warnOnce('SpatialHashGrid: Self-referencing entity', currentEntityIndex);
          break;
        }
        currentEntityIndex = nextIndex;
        iterationCount++;
      }

      if (iterationCount >= MAX_ITERATIONS) {
        warnOnce('SpatialHashGrid: Max iterations reached, possible infinite loop', {
          cellIndex,
          currentEntityIndex,
        });
      }
    }
  }

  // Convenience wrapper (allocates array - use queryRadiusInto for hot paths)
  queryRadius(position: { x: number; y: number }, radius: number): SpatialQueryResult {
    const startTime = performance.now();
    const indices: number[] = [];
    this.queryRadiusInto(position.x, position.y, radius, indices);

    this.queryCount++;
    const queryTime = performance.now() - startTime;
    this.totalQueryTime += queryTime;

    return {
      indices,
      cellCount: this.tempCellArray.length,
      queryTime,
    };
  }

  // EIDOLON ARCHITECT: O(n) Remove via Linked List Unlink
  remove(entityIndex: number): void {
    const cellIndex = this.entityCell[entityIndex];
    if (cellIndex === -1) return; // Not in grid

    // CRITICAL: Unlink from linked list
    let prevIndex = -1;
    let currentIndex = this.cellHead[cellIndex];

    while (currentIndex !== -1) {
      if (currentIndex === entityIndex) {
        // Found it - unlink
        if (prevIndex === -1) {
          // Removing head
          this.cellHead[cellIndex] = this.nextEntity[currentIndex];
        } else {
          // Removing middle/end
          this.nextEntity[prevIndex] = this.nextEntity[currentIndex];
        }
        break;
      }

      prevIndex = currentIndex;
      currentIndex = this.nextEntity[currentIndex];
    }

    // Clear cell tracking
    this.entityCell[entityIndex] = -1;
    this.staticEntityIndices.delete(entityIndex);
  }

  // Update entity position (check if cell changed)
  update(entityIndex: number, isStatic: boolean = false): void {
    // Robust update: remove from known OLD cell, add to NEW cell
    // This handles position changes correctly without needing to guess previous position
    this.remove(entityIndex);
    this.add(entityIndex, isStatic);
  }

  // Legacy compatibility helpers
  getNearby(entity: Entity, radiusOverride?: number): Entity[] {
    const idx = entity.physicsIndex;
    if (idx === undefined) return [];

    const tIdx = idx * 8;
    const x = TransformStore.data[tIdx];
    const y = TransformStore.data[tIdx + 1];

    const indices: number[] = [];
    const r = radiusOverride || entity.radius;

    this.queryRadiusInto(x, y, r, indices);

    const results: Entity[] = [];
    for (let i = 0; i < indices.length; i++) {
      const obj = EntityLookup[indices[i]];
      if (obj) results.push(obj);
    }
    return results;
  }

  insert(entity: Entity): void {
    if (entity.physicsIndex !== undefined) {
      this.add(entity.physicsIndex, entity.isStatic);
    }
  }

  removeStatic(entity: Entity): void {
    if (entity.physicsIndex !== undefined) {
      this.remove(entity.physicsIndex);
    }
  }

  // Stats
  getStats() {
    let occupiedCells = 0;
    let totalEntities = 0;
    let maxChainLength = 0;

    for (let cellIndex = 0; cellIndex < this.totalCells; cellIndex++) {
      let chainLength = 0;
      let currentEntityIndex = this.cellHead[cellIndex];

      while (currentEntityIndex !== -1) {
        chainLength++;
        currentEntityIndex = this.nextEntity[currentEntityIndex];
      }

      if (chainLength > 0) {
        occupiedCells++;
        totalEntities += chainLength;
        maxChainLength = Math.max(maxChainLength, chainLength);
      }
    }

    return {
      totalEntities,
      occupiedCells,
      maxChainLength,
      avgQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
    };
  }
}

// Global Export
export { SpatialHashGrid as SpatialGrid };
