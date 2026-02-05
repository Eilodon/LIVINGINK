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
    type IWinEntity,
    type IWinState,
    type IBossEntity,
    type IPlayerEntity,
    type IBossState,
    type IWaveState,
    type IRingEntity,
    type ITattooEntity,
    type IEngineGameState,
    TransformStore,
    PhysicsStore,
    StatsStore,
    defaultWorld,
} from '@cjr/engine';
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

    constructor(tickRate: number = 20) {
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

            // Read from DOD stores
            const x = TransformStore.getX(entityIndex);
            const y = TransformStore.getY(entityIndex);
            const vx = PhysicsStore.getVelocityX(entityIndex);
            const vy = PhysicsStore.getVelocityY(entityIndex);
            const radius = PhysicsStore.getRadius(entityIndex);
            const health = StatsStore.getCurrentHealth(entityIndex);

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
     * Legacy tick method - maintained for backward compatibility
     * @deprecated Use tickWithDirectMutation for IMPERATOR Phase 2
     */
    tick(
        state: IServerGameState,
        players: (IPlayerEntity & IRingEntity & ITattooEntity)[],
        bots: (IPlayerEntity & IRingEntity & ITattooEntity)[],
        boss: IBossEntity | null
    ): void {
        if (state.isPaused) return;

        const dt = this.dt;

        // 1. Physics (DOD)
        PhysicsSystem.update(dt);

        // 2. Movement (DOD)
        for (const player of players) {
            if (player.physicsIndex !== undefined) {
                // EIDOLON-V: Pass defaultWorld and dt
                MovementSystem.update(defaultWorld, player.physicsIndex, dt);
            }
        }
        for (const bot of bots) {
            if (bot.physicsIndex !== undefined) {
                MovementSystem.update(defaultWorld, bot.physicsIndex, dt);
            }
        }

        // 3. Skills (DOD)
        SkillSystem.update(dt);

        // 4. Ring Logic
        const allEntities = [...players, ...bots];
        for (const entity of allEntities) {
            if (!entity.isDead) {
                const result = checkRingTransition(entity as IRingEntity);
                if (result.transitioned) {
                    // Server can log or track ring transitions for anti-cheat
                }
            }
        }

        // 5. Tattoo Updates
        for (const entity of allEntities) {
            if (!entity.isDead && 'tattoos' in entity) {
                triggerTattooOnUpdate(entity as ITattooEntity, dt);
            }
        }

        // 6. Wave Spawner
        const spawnResult = updateWaveSpawner(state.runtime.wave, dt);
        // Server should add spawned food to authoritative state
        // This is handled by the room logic that calls this bridge

        // 7. Boss Logic
        const playerEntities = players.filter(p => !p.isDead);
        updateBossLogic(boss, playerEntities, dt);

        // 8. Win Condition
        const winEntities: IWinEntity[] = allEntities.filter(e => !e.isDead);
        const winState: IWinState = {
            result: state.result,
            kingId: state.kingId,
            shakeIntensity: state.shakeIntensity,
            runtime: {
                winCondition: state.runtime.winCondition,
            },
        };

        const winResult = updateWinConditionLogic(
            winEntities,
            winState,
            dt,
            state.levelConfig
        );

        // Sync win result back to state
        if (winResult.winner) {
            state.result = winState.result;
            state.kingId = winState.kingId;
        }

        // 9. Game Time
        state.gameTime += dt;
        if (state.gameTime > state.levelConfig.timeLimit && !state.result) {
            state.result = 'lose';
            state.isPaused = true;
        }

        // 10. IMPORTANT: Clear event buffer (server ignores VFX events)
        eventBuffer.clear();
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

// Export singleton for simple usage
export const serverEngineBridge = new ServerEngineBridge();
