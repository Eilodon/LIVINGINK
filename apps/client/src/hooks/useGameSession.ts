import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GameState } from '../types';
import { gameStateManager, GameEvent } from '../game/engine/GameStateManager';
import { NetworkStatus } from '../game/networking/NetworkClient';
import {
  loadSettings,
  loadProgression,
  defaultSettings,
  defaultProgression,
  saveSettings,
  saveProgression,
} from '../core/ui/storage';
import {
  initialUiState,
  pushOverlay,
  popOverlay,
  clearOverlays,
  UiState,
  Screen,
} from '../core/ui/screenMachine';
import { ShapeId } from '../game/cjr/cjrTypes';
import { MatchmakingStatus } from '../core/meta/matchmaking';

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
    matchmakingRegion: 'us-east',
  });

  // 2. REFS (Performance Critical)
  const gameStateRef = useRef<GameState | null>(null);
  const alphaRef = useRef(0);
  // Auto-detect touch device
  const isTouch = useRef(
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  ).current;

  // Persist settings/progression
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  useEffect(() => {
    saveProgression(progression);
  }, [progression]);

  // Function to reset state when entering a new game session:
  useEffect(() => {
    // EIDOLON-V FIX: Subscribe to GameStateManager events
    const unsubEvents = gameStateManager.subscribeEvent((event: GameEvent) => {
      switch (event.type) {
        case 'LEVEL_UNLOCKED':
          setProgression(p => ({
            ...p,
            unlockedLevel: Math.max(p.unlockedLevel, event.level),
          }));
          break;
        case 'GAME_OVER':
          // Note: progression handled in LEVEL_UNLOCKED now
          setUi(s => ({ ...clearOverlays(s), screen: 'gameOver' }));
          break;
        case 'TATTOO_REQUEST':
          setUi(s => {
            if (s.overlays.some(o => o.type === 'tattooPick')) return s;
            return pushOverlay(s, { type: 'tattooPick' });
          });
          break;
      }
    });

    const unsubState = gameStateManager.subscribe(state => {
      gameStateRef.current = state;
    });

    // Setup Render Callback
    gameStateManager.setRenderCallback(alpha => {
      alphaRef.current = alpha;
    });

    return () => {
      unsubEvents();
      unsubState();
      gameStateManager.setRenderCallback(() => {}); // cleanup
    };
  }, []);

  // 3. GAME LOOP HANDLERS
  // EIDOLON-V FIX: onUpdate and onRender are now handled by GameStateManager internally
  // and their logic is moved into GameStateManager's update and render methods.

  // 4. ACTIONS
  // Core Actions defined as stable callbacks to allow internal reuse
  const startGame = useCallback(
    (name: string, shape: ShapeId, level: number, multiplayer = false) => {
      try {
        // EIDOLON-V FIX: Delegate to GameStateManager
        gameStateManager.startSession({
          name,
          shape,
          level,
          useMultiplayer: multiplayer,
          usePixi: settings.usePixi, // EIDOLON-V FIX: Pass usePixi
        });

        const state = gameStateManager.getCurrentState();
        if (!state) {
          console.error('CRITICAL: GameState is null after startSession');
          return;
        }

        gameStateRef.current = state;
        setUi(s => ({ ...clearOverlays(s), screen: 'playing' }));
      } catch (error) {
        console.error('Failed to start game:', error);
      }
    },
    [settings.usePixi]
  ); // Added usePixi dependency

  const quitGame = useCallback(() => {
    // EIDOLON-V FIX: Use centralized end session
    gameStateManager.endSession();
    gameStateRef.current = null;
    setUi(s => ({ ...clearOverlays(s), screen: 'menu' }));
  }, []);

  const actions = React.useMemo(
    () => ({
      game: {
        start: startGame,
        quit: quitGame,
        retry: () => {
          const state = gameStateRef.current;
          if (state)
            startGame(
              state.player.name,
              state.player.shape as ShapeId,
              state.level,
              settings.useMultiplayer
            );
        },
        nextLevel: () => {
          const state = gameStateRef.current;
          if (state)
            startGame(state.player.name, state.player.shape as ShapeId, state.level + 1, false);
        },
      },
      ui: {
        setScreen: (screen: Screen) => setUi(s => ({ ...clearOverlays(s), screen })),
        pushOverlay: (ov: any) =>
          setUi(s => {
            const next = pushOverlay(s, ov);
            if (gameStateRef.current) gameStateRef.current.isPaused = true;
            return next;
          }),
        popOverlay: (type?: string) =>
          setUi(s => {
            const next = popOverlay(s, type as any);
            if (next.overlays.length === 0 && gameStateRef.current)
              gameStateRef.current.isPaused = false;
            return next;
          }),
        returnToMenu: () => {
          quitGame();
        },
        togglePixi: (v: boolean) => setSettings(s => ({ ...s, usePixi: v })),
        toggleMultiplayer: (v: boolean) => setSettings(s => ({ ...s, useMultiplayer: v })),
        setMenuName: (name: string) => setMeta(m => ({ ...m, menuName: name })),
        setMenuShape: (shape: ShapeId) => setMeta(m => ({ ...m, menuShape: shape })),
        setMatchmakingRegion: (region: string) =>
          setMeta(m => ({ ...m, matchmakingRegion: region })),
      },
      meta: {
        setName: (name: string) => setMeta(m => ({ ...m, menuName: name })),
        setShape: (shape: ShapeId) => setMeta(m => ({ ...m, menuShape: shape })),
        setLevel: (lvl: number) => setMeta(m => ({ ...m, selectedLevel: lvl })),
        startQueue: () => {
          /* ... */
        },
        cancelQueue: () => {
          /* ... */
        },
        startTournamentQueue: () => {
          /* ... */
        },
        cancelTournamentQueue: () => {
          /* ... */
        },
      },
      settings: {
        togglePixi: (v: boolean) => setSettings(s => ({ ...s, usePixi: v })),
        toggleMultiplayer: (v: boolean) => setSettings(s => ({ ...s, useMultiplayer: v })),
      },
    }),
    [startGame, quitGame, settings.useMultiplayer]
  ); // Rebuild actions if these change

  return {
    ui,
    state: { level: gameStateRef.current?.level, lastResult: gameStateRef.current?.result },
    actions,
    refs: { gameState: gameStateRef, alpha: alphaRef },
    settings,
    progression,
    isTouch,
    meta,
  };
};
