/**
 * @cjr/engine - CollisionSystem
 * Handles physical interactions between entities (Eating, Projectile hits)
 * Uses Spatial Hash Grid for O(N) performance with thousands of entities.
 */

import { WorldState } from '../generated/WorldState';
import {
    EntityFlags,
    TransformAccess,
    PhysicsAccess,
    StateAccess,
    StatsAccess,
    PigmentAccess,
    ConfigAccess,
    ProjectileAccess,
} from '../generated/ComponentAccessors';
import { FastMath } from '../math/FastMath';
import { calcMatchPercentFast } from '../modules/cjr/colorMath';

// ============================================
// SPATIAL HASH GRID
// ============================================

class SpatialHash {
    private cellSize: number;
    private map: Map<number, number[]>;

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.map = new Map();
    }

    clear(): void {
        this.map.clear();
    }

    private getKey(x: number, y: number): number {
        // Cantor pairing or simple string hash? Use bitwise for speed.
        // Map is +/- 2500. Cell size ~100. Range -25 to 25.
        // Key = (x + 1000) | ((y + 1000) << 16)
        const cellX = Math.floor(x / this.cellSize) + 1000;
        const cellY = Math.floor(y / this.cellSize) + 1000;
        return (cellX & 0xFFFF) | ((cellY & 0xFFFF) << 16);
    }

    insert(id: number, x: number, y: number): void {
        const key = this.getKey(x, y);
        let cell = this.map.get(key);
        if (!cell) {
            cell = [];
            this.map.set(key, cell);
        }
        cell.push(id);
    }

    // Query for IDs in cells surrounding the rect
    query(x: number, y: number, radius: number, result: number[]): void {
        const startX = Math.floor((x - radius) / this.cellSize) + 1000;
        const endX = Math.floor((x + radius) / this.cellSize) + 1000;
        const startY = Math.floor((y - radius) / this.cellSize) + 1000;
        const endY = Math.floor((y + radius) / this.cellSize) + 1000;

        for (let cy = startY; cy <= endY; cy++) {
            for (let cx = startX; cx <= endX; cx++) {
                const key = (cx & 0xFFFF) | ((cy & 0xFFFF) << 16);
                const cell = this.map.get(key);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) {
                        result.push(cell[i]);
                    }
                }
            }
        }
    }
}

// Global Spatial Hash instance (reused)
// Cell size 100 (good for food radius ~8-12 and player ~30-100)
const spatialHash = new SpatialHash(100);
const queryBuffer: number[] = []; // Reused buffer to avoid allocation

// ============================================
// COLLISION SYSTEM
// ============================================

export class CollisionSystem {

    static update(world: WorldState, dt: number): void {
        // 1. Build Spatial Hash for PASSIVE entities (Food)
        // We only care about active food.
        spatialHash.clear();

        const count = world.activeCount;
        const activeEntities = world.activeEntities;

        // Pass 1: Insert Food into Hash
        for (let i = 0; i < count; i++) {
            const id = activeEntities[i];
            const flags = StateAccess.getFlags(world, id);

            // Filter: ACTIVE && FOOD && !DEAD
            if ((flags & EntityFlags.FOOD) && !(flags & EntityFlags.DEAD)) {
                const x = TransformAccess.getX(world, id);
                const y = TransformAccess.getY(world, id);
                spatialHash.insert(id, x, y);
            }
            // Filter: ACTIVE && PROJECTILE && !DEAD
            else if ((flags & EntityFlags.PROJECTILE) && !(flags & EntityFlags.DEAD)) {
                const x = TransformAccess.getX(world, id);
                const y = TransformAccess.getY(world, id);
                spatialHash.insert(id, x, y);
            }
        }

        // Pass 2: Check Collisions for ACTIVE AGENTS (Players/Bots)
        for (let i = 0; i < count; i++) {
            const id = activeEntities[i];
            const flags = StateAccess.getFlags(world, id);

            // Filter: ACTIVE && (PLAYER | BOT) && !DEAD
            const isAgent = (flags & (EntityFlags.PLAYER | EntityFlags.BOT));
            if (isAgent && !(flags & EntityFlags.DEAD)) {
                this.processAgentCollision(world, id);
            }
        }
    }


    // EIDOLON-V: Resolve Projectile Hit
    private static resolveProjectileHit(world: WorldState, agentId: number, projectileId: number): void {
        const ownerId = ProjectileAccess.getOwnerId(world, projectileId);

        // Don't hit self
        if (ownerId === agentId) return;

        // Apply Damage
        const damage = ProjectileAccess.getDamage(world, projectileId);
        const hp = StatsAccess.getHp(world, agentId);
        StatsAccess.setHp(world, agentId, hp - damage);

        // Destroy Projectile
        StateAccess.markDead(world, projectileId);
        StateAccess.deactivate(world, projectileId);

        // Optional: Knockback?
        // Using PhysicsAccess.setVelocity etc.
    }

    private static processAgentCollision(world: WorldState, agentId: number): void {
        const x = TransformAccess.getX(world, agentId);
        const y = TransformAccess.getY(world, agentId);

        // Use Config for pickup range, or Physics radius?
        // Usually pickup range > physics radius.
        const pickupRange = ConfigAccess.getPickupRange(world, agentId) || PhysicsAccess.getRadius(world, agentId);

        // Reuse buffer
        queryBuffer.length = 0;
        spatialHash.query(x, y, pickupRange, queryBuffer);

        for (let i = 0; i < queryBuffer.length; i++) {
            const foodId = queryBuffer[i];

            // Double check validation (could be stale in hash if multiple agents eat same food in same frame? handle below)
            if (StateAccess.isDead(world, foodId)) continue;

            const foodX = TransformAccess.getX(world, foodId);
            const foodY = TransformAccess.getY(world, foodId);
            const foodRadius = PhysicsAccess.getRadius(world, foodId);

            // Strict Circle Collision
            const distSq = FastMath.distanceSquared({ x, y }, { x: foodX, y: foodY });
            const hitRadius = pickupRange + foodRadius;

            if (distSq < hitRadius * hitRadius) {
                // Check Type: Food or Projectile
                // Food eating
                if (StateAccess.hasFlag(world, foodId, EntityFlags.FOOD)) {
                    this.resolveEating(world, agentId, foodId);
                }
                // Projectile hit
                else if (StateAccess.hasFlag(world, foodId, EntityFlags.PROJECTILE)) {
                    this.resolveProjectileHit(world, agentId, foodId);
                }
            }
        }
    }

    private static resolveEating(world: WorldState, agentId: number, foodId: number): void {
        // 1. Mark Food as Dead (Atomic claim)
        StateAccess.markDead(world, foodId);

        // 2. Get Food Stats (Kind is not in DOD? We can infer from Radius or Pigment)
        // Pigment check:
        const r = PigmentAccess.getR(world, foodId);
        const g = PigmentAccess.getG(world, foodId);
        const b = PigmentAccess.getB(world, foodId);

        // Check if neutral (0,0,0) or pigmented
        const isPigment = r > 0 || g > 0 || b > 0;

        // 3. Update Player Schema (Score, Mass)
        // Score
        const currentScore = StatsAccess.getScore(world, agentId);
        // Value: 5 for neutral (radius 8), 2 for pigment (radius 12), 10 for orb? 
        // We'll trust hardcoded values for now since 'kind' isn't in DOD yet (Need to add generic TypeID to stats?)
        const value = isPigment ? 2 : 5;
        StatsAccess.setScore(world, agentId, currentScore + value);

        // 4. Update Player Pigment
        if (isPigment) {
            const agentR = PigmentAccess.getR(world, agentId);
            const agentG = PigmentAccess.getG(world, agentId);
            const agentB = PigmentAccess.getB(world, agentId);

            // Simple additive blending with clamp
            // Or interpolation? Original game used simple add with max.
            // Let's blend 10% towards food color
            const blend = 0.1;
            const newR = FastMath.clamp(agentR + (r - agentR) * blend, 0, 1);
            const newG = FastMath.clamp(agentG + (g - agentG) * blend, 0, 1);
            const newB = FastMath.clamp(agentB + (b - agentB) * blend, 0, 1);

            PigmentAccess.setR(world, agentId, newR);
            PigmentAccess.setG(world, agentId, newG);
            PigmentAccess.setB(world, agentId, newB);

            // Recalculate match percent
            const targetR = PigmentAccess.getTargetR(world, agentId);
            const targetG = PigmentAccess.getTargetG(world, agentId);
            const targetB = PigmentAccess.getTargetB(world, agentId);

            const match = calcMatchPercentFast(
                { r: newR, g: newG, b: newB },
                { r: targetR, g: targetG, b: targetB }
            );

            StatsAccess.setMatchPercent(world, agentId, match);
            PigmentAccess.setMatchPercent(world, agentId, match);
        }

        // 5. Grow (Mass/Radius) logic?
        // Standard agar.io mechanic: Area += Value
        // For now, simpler: just Score.

        // Heal logic?
        const hp = StatsAccess.getHp(world, agentId);
        const maxHp = StatsAccess.getMaxHp(world, agentId);
        if (hp < maxHp) {
            StatsAccess.setHp(world, agentId, Math.min(maxHp, hp + value));
        }
    }
}
