import { GameSessionConfig, GameEvent } from '../GameStateManager';
import { GameState, Player } from '@/types';
import { NetworkClient } from '@/network/NetworkClient';
import { createInitialState } from '../index';
import { clientLogger } from '@/core/logging/ClientLogger';
import { pooledEntityFactory } from '@/game/pooling/ObjectPool';
import { BufferedInput } from '@/game/input/BufferedInput';
import { PhysicsWorld } from '../PhysicsWorld';
import { getCurrentEngine, getWorld } from '../context';

export class SessionManager {
    private currentConfig: GameSessionConfig | null = null;

    constructor(
        private readonly networkClient: NetworkClient,
        private readonly bufferedInput: BufferedInput,
        private readonly emitEvent: (event: GameEvent) => void
    ) { }

    public getCurrentConfig(): GameSessionConfig | null {
        return this.currentConfig;
    }

    public startSession(config: GameSessionConfig, stopLoopCallback: () => void, startLoopCallback: () => void): GameState {
        try {
            clientLogger.info('🎮 Starting game session', { name: config.name, level: config.level });

            // 1. Clean up old session
            stopLoopCallback();
            this.bufferedInput.reset();

            // 2. Setup Configuration
            this.currentConfig = config;

            // 3. Create State
            const state = createInitialState(config.level);
            if (!state) {
                throw new Error('Failed to create initial state');
            }
            clientLogger.info('✅ Initial state created', { playerId: state.player?.id });

            // 4. Configure Player
            if (state.player) {
                state.player.name = config.name;
                state.player.shape = config.shape;
                state.player.velocity = { x: 0, y: 0 };
                clientLogger.info('✅ Player configured', { name: config.name, shape: config.shape });
            } else {
                throw new Error('Player not found in initial state');
            }

            // 5. Connect Networking (if valid)
            // EIDOLON-V AUDIT FIX: Set local state BEFORE connecting to prevent stale state race
            // (connectWithRetry is async and may receive messages before setLocalState ran)
            if (config.useMultiplayer) {
                this.networkClient.setLocalState(state);
                this.networkClient.connectWithRetry(config.name, config.shape);
            }

            // 6. Start Loop
            startLoopCallback();
            clientLogger.info('✅ Game loop started');
            return state;
        } catch (error) {
            clientLogger.error(
                '❌ Failed to start session',
                undefined,
                error instanceof Error ? error : undefined
            );
            throw error;
        }
    }

    public endSession(stopLoopCallback: () => void): void {
        stopLoopCallback();
        this.networkClient.disconnect();

        // Reset DOD stores and pools to prevent memory leaks
        try {
            getWorld().reset();
        } catch {
            // getWorld() may throw if engine not bound - that's fine during cleanup
        }
        pooledEntityFactory.clear();

        // Clear spatial grid if applicable
        try {
            // Access via engine context if possible, or assume global cleanup is handled by resetAllStores/GameRoom
            const engine = getCurrentEngine();
            if (engine && engine.physicsWorld) {
                // engine.physicsWorld.clear(); // If method exists
            }
        } catch (e) {
            // Ignore
        }
    }
}
