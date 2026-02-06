/**
 * IMPERATOR Phase 2: ServerEngineBridge with Direct State Mutation
 * 
 * Breaking Change: Engine now writes directly to IEngineGameState,
 * bypassing manual syncDODToSchema steps.
 */

import {
    eventBuffer,
    PhysicsSystem,
    MovementSystem,
    SkillSystem,
    updateWaveSpawner,
    updateBossLogic,
    updateWinConditionLogic,
    checkRingTransition,
    triggerTattooOnUpdate,
    WorldState, // EIDOLON-V P6 FIX: Import WorldState type
    type IWinEntity,
    type IWinState,
    type IBossEntity,
    type IPlayerEntity,
    type IBossState,
    type IWaveState,
    type IRingEntity,
    type ITattooEntity,
    type IEngineGameState,
} from '@cjr/engine';
import { TransformAccess, PhysicsAccess, StatsAccess } from '@cjr/engine'; // EIDOLON-V P6 FIX: Use generated accessors
import { logger } from '../logging/Logger';

/**
 * Server-side game state interface
 */
interface IServerGameState {
    isPaused: boolean;
    gameTime: number;
    result?: 'win' | 'lose' | null;
    kingId?: string;
    shakeIntensity?: number;
    runtime: {
        wave: {
            ring1: number;
            ring2: number;
            ring3: number;
        };
        winCondition?: {
            timer: number;
        };
        boss: {
            bossDefeated: boolean;
            rushWindowTimer: number;
            rushWindowRing: number | null;
            currentBossActive: boolean;
            attackCharging: boolean;
            attackTarget: IPlayerEntity | null;
            attackChargeTimer: number;
        };
    };
    levelConfig: {
        winCondition?: 'default' | 'hold_center';
        winHoldSeconds?: number;
        timeLimit: number;
    };
}

export class ServerEngineBridge {
    private tickRate: number;
    private dt: number;
    private entities: Map<string, number> = new Map(); // sessionId -> dodIndex
    private world: WorldState; // EIDOLON-V P6 FIX: Instance-based world

    constructor(world: WorldState, tickRate: number = 20) {
        this.world = world;
        this.tickRate = tickRate;
        this.dt = 1 / tickRate;
    }

    /**
     * Add a player to the simulation
     * Returns the DOD entity index
     */
    addPlayer(sessionId: string, name: string, shape: string): number {
        // This is a placeholder - actual implementation would use DOD stores
        // For now, just track the entity
        const dodIndex = this.entities.size;
        this.entities.set(sessionId, dodIndex);
        return dodIndex;
    }

    /**
     * Remove a player from the simulation
     */
    removePlayer(sessionId: string): void {
        this.entities.delete(sessionId);
    }

    /**
     * IMPERATOR Phase 2: Direct State Mutation
     * Writes DOD store values directly to IEngineGameState,
     * eliminating the need for syncDODToSchema in GameRoom.
     * 
     * Call this after PhysicsSystem.update() and MovementSystem.update()
     */
    syncDODToEngineState(
        state: IEngineGameState,
        entityIndices: Map<string, number>
    ): void {
        // Direct mutation: DOD stores → Engine State
        for (const [sessionId, entityIndex] of entityIndices) {
            const player = state.players.get(sessionId);
            if (!player) continue;

            // Read from DOD stores using instance world
            const x = TransformAccess.getX(this.world, entityIndex);
            const y = TransformAccess.getY(this.world, entityIndex);
            const vx = PhysicsAccess.getVx(this.world, entityIndex);
            const vy = PhysicsAccess.getVy(this.world, entityIndex);
            const radius = PhysicsAccess.getRadius(this.world, entityIndex);
            const health = StatsAccess.getHp(this.world, entityIndex);

            // Direct write to state (bypassing manual sync)
            player.setPosition(x, y);
            player.setVelocity(vx, vy);
            player.setRadius(radius);
            player.setHealth(health);

            // Mark as dead if health <= 0
            if (health <= 0 && !player.isDead) {
                player.setDead(true);
                logger.debug('Player died via direct state mutation', { sessionId });
            }
        }

        // Update game time
        state.incrementGameTime(this.dt);
    }

    /**
     * Get spawn results from last wave spawner update
     * Room can use this to create authoritative food entities
     */
    getSpawnResults(waveState: IWaveState['runtime']['wave'], dt: number) {
        return updateWaveSpawner(waveState, dt);
    }

    /**
     * Get tick rate
     */
    getTickRate(): number {
        return this.tickRate;
    }

    /**
     * Get delta time
     */
    getDeltaTime(): number {
        return this.dt;
    }
}
