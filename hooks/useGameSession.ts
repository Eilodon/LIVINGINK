import { useState, useRef, useCallback, useEffect } from 'react';
import { GameState } from '../types';
import { createInitialState, updateClientVisuals, updateGameState } from '../services/engine';
import { gameStateManager } from '../services/engine/GameStateManager'; // EIDOLON-V FIX: Import GameStateManager
import { networkClient, NetworkStatus } from '../services/networking/NetworkClient';
import { audioEngine } from '../services/audio/AudioEngine'; // EIDOLON-V FIX: Use unified AudioEngine
import { inputManager } from '../services/input/InputManager';
import { loadSettings, loadProgression, defaultSettings, defaultProgression, saveSettings, saveProgression } from '../services/ui/storage';
import { initialUiState, pushOverlay, popOverlay, clearOverlays, UiState, Screen } from '../services/ui/screenMachine';
import { ShapeId } from '../services/cjr/cjrTypes';
import { MatchmakingStatus } from '../services/meta/matchmaking';

// Define missing types locally or import if available
export type TournamentQueueStatus = 'idle' | 'queued' | 'ready';

interface MetaState {
    menuName: string;
    menuShape: ShapeId;
    selectedLevel: number;
    matchmakingStatus: MatchmakingStatus;
    matchmaking: { status: MatchmakingStatus; queuedAt: number };
    tournamentQueue: { status: TournamentQueueStatus };
    networkStatus: NetworkStatus;
    webglSupported: boolean;
    matchmakingRegion: string;
}

export const useGameSession = () => {
    // 1. STATE (UI & Meta only)
    const [ui, setUi] = useState<UiState>(initialUiState);
    const [settings, setSettings] = useState(() => loadSettings() || defaultSettings);
    const [progression, setProgression] = useState(() => loadProgression() || defaultProgression);

    const [meta, setMeta] = useState<MetaState>({
        menuName: 'Jelly',
        menuShape: 'circle' as ShapeId,
        selectedLevel: 1,
        matchmakingStatus: 'idle',
        matchmaking: { status: 'idle', queuedAt: 0 },
        tournamentQueue: { status: 'idle' },
        networkStatus: 'offline',
        webglSupported: true,
        matchmakingRegion: 'us-east'
    });

    // 2. REFS (Performance Critical)
    const gameStateRef = useRef<GameState | null>(null);
    const alphaRef = useRef(0);
    // Auto-detect touch device
    const isTouch = useRef(typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)).current;

    // Persist settings/progression
    useEffect(() => { saveSettings(settings); }, [settings]);
    useEffect(() => { saveProgression(progression); }, [progression]);

    // EIDOLON-V FIX: Initialize AudioEngine and Input Manager
    useEffect(() => {
      inputManager.init();
      audioEngine.initialize();

      return () => {
        audioEngine.dispose();
      };
    }, []);

    // 3. GAME LOOP HANDLERS
    const onUpdate = useCallback((dt: number) => {
        // EIDOLON-V FIX: Remove debug console.log
        // console.log('DEBUG: Loop Tick', dt, gameStateRef.current?.isPaused);
        const state = gameStateRef.current;
        if (!state || state.isPaused) return;

        // Logic Update
        if (settings.useMultiplayer && networkClient.getRoomId()) {
            // Multiplayer
            updateClientVisuals(state, dt);

            // Send Inputs
            const events = inputManager.popEvents();
            const moveTarget = inputManager.getMoveTarget(state.player.position);

            // MAP INPUTS: Local (skill/eject) -> Network (space/w)
            const actions = inputManager.state.actions;
            const networkInputs = {
                space: actions.skill,
                w: actions.eject
            };

            networkClient.sendInput(moveTarget, networkInputs, dt, events);
        } else {
            // Singleplayer
            const events = inputManager.popEvents();
            if (events.length > 0) {
                if (!state.player.inputEvents) state.player.inputEvents = [];
                state.player.inputEvents.push(...events);
                // EIDOLON-V FIX: Remove debug console.log
                // console.log('DEBUG: Input events processed:', events.length);
            }

            const move = inputManager.state.move;
            if (move.x !== 0 || move.y !== 0) {
                state.player.targetPosition.x = state.player.position.x + move.x * 200;
                state.player.targetPosition.y = state.player.position.y + move.y * 200;
                // EIDOLON-V FIX: Remove debug console.log
                // console.log('DEBUG: Movement input detected:', move, 'New target:', state.player.targetPosition);
            }

            updateGameState(state, dt);
        }

        // Audio & VFX Sync - EIDOLON-V FIX: Use unified AudioEngine
        audioEngine.setListenerPosition(state.player.position.x, state.player.position.y);
        audioEngine.setBGMIntensity(Math.floor(state.player.matchPercent * 4));

        // Check Win/Loss
        if (state.result) {
            if (state.result === 'win') {
                setProgression(p => ({ ...p, unlockedLevel: Math.max(p.unlockedLevel, state.level + 1) }));
            }
            gameStateManager.stopGameLoop(); // EIDOLON-V FIX: Use GameStateManager
            setUi(s => ({ ...clearOverlays(s), screen: 'gameOver' }));
        }

        // Check Tattoos
        if (state.tattooChoices && !ui.overlays.some(o => o.type === 'tattooPick')) {
            setUi(s => pushOverlay(s, { type: 'tattooPick' }));
        }

    }, [settings.useMultiplayer, ui.overlays]);

    const onRender = useCallback((alpha: number) => {
        alphaRef.current = alpha;
    }, []);

    // 4. ACTIONS
    const actions = {
        game: {
            start: (name: string, shape: ShapeId, level: number, multiplayer = false) => {
                gameStateManager.stopGameLoop(); // EIDOLON-V FIX: Stop existing loop

                const state = gameStateManager.createInitialState(level);
                state.player.name = name;
                state.player.shape = shape;
                gameStateRef.current = state;

                // EIDOLON-V FIX: Set callbacks in GameStateManager
                gameStateManager.setGameLoopCallbacks(onUpdate, onRender);

                if (multiplayer) {
                    networkClient.connectWithRetry(name, shape);
                    networkClient.setLocalState(state);
                }

                setUi(s => ({ ...clearOverlays(s), screen: 'playing' }));

                gameStateManager.startGameLoop(60); // EIDOLON-V FIX: Use GameStateManager

                // Reset Input
                inputManager.state.actions = { skill: false, eject: false };
            },
            quit: () => {
                gameStateManager.stopGameLoop(); // EIDOLON-V FIX: Use GameStateManager
                networkClient.disconnect();
                gameStateRef.current = null;
                setUi(s => ({ ...clearOverlays(s), screen: 'menu' }));
            },
            retry: () => {
                const state = gameStateRef.current;
                if (state) actions.game.start(state.player.name, state.player.shape as ShapeId, state.level, settings.useMultiplayer);
            },
            nextLevel: () => {
                const state = gameStateRef.current;
                if (state) actions.game.start(state.player.name, state.player.shape as ShapeId, state.level + 1, false);
            }
        },
        ui: {
            setScreen: (screen: Screen) => setUi(s => ({ ...clearOverlays(s), screen })),
            pushOverlay: (ov: any) => setUi(s => {
                const next = pushOverlay(s, ov);
                if (gameStateRef.current) gameStateRef.current.isPaused = true;
                return next;
            }),
            popOverlay: (type?: string) => setUi(s => {
                const next = popOverlay(s, type as any);
                if (next.overlays.length === 0 && gameStateRef.current) gameStateRef.current.isPaused = false;
                return next;
            }),
            returnToMenu: () => {
                actions.game.quit();
            },
            togglePixi: (v: boolean) => setSettings(s => ({ ...s, usePixi: v })),
            toggleMultiplayer: (v: boolean) => setSettings(s => ({ ...s, useMultiplayer: v })),
            setMenuName: (name: string) => setMeta(m => ({ ...m, menuName: name })),
            setMenuShape: (shape: ShapeId) => setMeta(m => ({ ...m, menuShape: shape })),
            setMatchmakingRegion: (region: string) => setMeta(m => ({ ...m, matchmakingRegion: region })),
        },
        meta: {
            setName: (name: string) => setMeta(m => ({ ...m, menuName: name })),
            setShape: (shape: ShapeId) => setMeta(m => ({ ...m, menuShape: shape })),
            setLevel: (lvl: number) => setMeta(m => ({ ...m, selectedLevel: lvl })),
            startQueue: () => { /* ... matchmaking logic ... */ },
            cancelQueue: () => { /* ... */ },
            startTournamentQueue: () => { /* ... */ },
            cancelTournamentQueue: () => { /* ... */ }
        },
        settings: {
            togglePixi: (v: boolean) => setSettings(s => ({ ...s, usePixi: v })),
            toggleMultiplayer: (v: boolean) => setSettings(s => ({ ...s, useMultiplayer: v }))
        }
    };

    return { ui, state: { level: gameStateRef.current?.level, lastResult: gameStateRef.current?.result }, actions, refs: { gameState: gameStateRef, alpha: alphaRef }, settings, progression, isTouch, meta };
};
