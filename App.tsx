import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameState, TattooId } from './types';
import { ShapeId } from './services/cjr/cjrTypes';
import { createInitialState, updateGameState } from './services/engine';
import MainMenu from './components/MainMenu';
import HUD from './components/HUD';
import MobileControls from './components/MobileControls';
import GameCanvas from './components/GameCanvas';
import TattooPicker from './components/TattooPicker';
import ErrorBoundary from './components/ErrorBoundary';
import BootScreen from './components/screens/BootScreen';
import LevelSelectScreen from './components/screens/LevelSelectScreen';
import GameOverScreen from './components/screens/GameOverScreen';
import PauseOverlay from './components/overlays/PauseOverlay';
import SettingsOverlay from './components/overlays/SettingsOverlay';
import TutorialOverlay from './components/overlays/TutorialOverlay';
import {
  clearOverlays,
  initialUiState,
  popOverlay,
  pushOverlay,
  topOverlay,
  type UiState,
} from './services/ui/screenMachine';
import {
  defaultProgression,
  defaultSettings,
  loadProgression,
  loadSettings,
  saveProgression,
  saveSettings,
  type Progression,
  type Settings,
} from './services/ui/storage';
import { applyTattoo } from './services/cjr/tattoos';

const PixiGameCanvas = React.lazy(() => import('./components/PixiGameCanvas'));

const clampLevel = (n: number) => Math.max(1, Math.min(20, Math.round(n)));

const App: React.FC = () => {
  const [ui, setUi] = useState<UiState>(initialUiState);
  const uiRef = useRef(ui);
  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  const [settings, setSettings] = useState<Settings>(() => {
    try {
      return typeof window !== 'undefined' ? loadSettings() : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [progression, setProgression] = useState<Progression>(() => {
    try {
      return typeof window !== 'undefined' ? loadProgression() : defaultProgression;
    } catch {
      return defaultProgression;
    }
  });

  const [selectedLevel, setSelectedLevel] = useState(() => clampLevel(progression.unlockedLevel));

  useEffect(() => {
    try {
      saveSettings(settings);
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      saveProgression(progression);
    } catch {
      // ignore
    }
  }, [progression]);

  const gameStateRef = useRef<GameState | null>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastStartRef = useRef<{ name: string; shape: ShapeId } | null>(null);
  const resultHandledRef = useRef<GameState['result']>(null);
  const tattooOverlayArmedRef = useRef(false);

  const [isTouch, setIsTouch] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setUi(s => ({ ...s, screen: 'menu' })), 250);
    return () => window.clearTimeout(t);
  }, []);

  const startGame = useCallback((name: string, shape: ShapeId, nextLevel: number) => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = 0;

    const state = createInitialState(nextLevel);
    state.player.name = name;
    state.player.shape = shape;

    gameStateRef.current = state;
    resultHandledRef.current = null;
    tattooOverlayArmedRef.current = false;
    lastStartRef.current = { name, shape };
    setSelectedLevel(nextLevel);

    setUi(() => ({ screen: 'playing', overlays: [] }));

    if (!progression.tutorialSeen && nextLevel <= 3) {
      state.isPaused = true;
      setUi((s) => pushOverlay(s, { type: 'tutorial', step: 0 }));
    }
  }, [progression.tutorialSeen]);

  const gameLoop = useCallback((time: number) => {
    const state = gameStateRef.current;
    if (!state) return;

    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    const safeDt = Math.min(dt, 0.1);
    if (!state.isPaused) updateGameState(state, safeDt);

    if (state.tattooChoices && !tattooOverlayArmedRef.current) {
      tattooOverlayArmedRef.current = true;
      setUi((s) => pushOverlay(s, { type: 'tattooPick' }));
    }
    if (!state.tattooChoices && tattooOverlayArmedRef.current) {
      tattooOverlayArmedRef.current = false;
      setUi((s) => popOverlay(s, 'tattooPick'));
    }

    if (state.result && resultHandledRef.current !== state.result) {
      resultHandledRef.current = state.result;

      if (state.result === 'win') {
        setProgression((p) => ({
          ...p,
          unlockedLevel: Math.max(p.unlockedLevel, clampLevel((state.level ?? selectedLevel) + 1)),
        }));
      }

      setUi(() => ({ screen: 'gameOver', overlays: [] }));
      return;
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [selectedLevel]);

  useEffect(() => {
    if (ui.screen !== 'playing' || !gameStateRef.current) return;

    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = 0;
    };
  }, [ui.screen, gameLoop]);

  useEffect(() => {
    const state = gameStateRef.current;
    if (!state) return;
    if (ui.screen !== 'playing') return;
    if (state.result) return;
    if (state.tattooChoices) return;
    state.isPaused = ui.overlays.length > 0;
  }, [ui.overlays.length, ui.screen]);

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (!state) return;
      if (uiRef.current.screen !== 'playing') return;
      if (uiRef.current.overlays.length > 0) return;
      if (e.code === 'Space') state.inputs.space = true;
      if (e.code === 'KeyW') state.inputs.w = true;
    };
    const handleUp = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (!state) return;
      if (e.code === 'Space') state.inputs.space = false;
      if (e.code === 'KeyW') state.inputs.w = false;
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      if (uiRef.current.screen !== 'playing') return;
      e.preventDefault();
      setUi((s) => {
        const top = topOverlay(s);
        if (top?.type === 'pause') return popOverlay(s, 'pause');
        return pushOverlay(s, { type: 'pause' });
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleTattooSelect = useCallback((id: TattooId) => {
    const state = gameStateRef.current;
    if (!state) return;
    applyTattoo(state.player, id, state);
    state.tattooChoices = null;
    state.isPaused = false;
    setUi((s) => popOverlay(s, 'tattooPick'));
  }, []);

  const inputEnabled = ui.screen === 'playing' && ui.overlays.length === 0;
  const top = useMemo(() => topOverlay(ui), [ui]);

  return (
    <div className="w-full h-screen overflow-hidden bg-black select-none font-sans">
      <ErrorBoundary>
        {ui.screen === 'boot' && <BootScreen />}

        {ui.screen === 'menu' && (
          <MainMenu
            level={selectedLevel}
            unlockedLevel={progression.unlockedLevel}
            usePixi={settings.usePixi}
            onTogglePixi={(next) => setSettings((s) => ({ ...s, usePixi: next }))}
            onOpenLevels={() => setUi((s) => ({ ...clearOverlays(s), screen: 'levelSelect' }))}
            onOpenTutorial={() => setUi((s) => pushOverlay(s, { type: 'tutorial', step: 0 }))}
            onOpenSettings={() => setUi((s) => pushOverlay(s, { type: 'settings' }))}
            onStart={(name, shape) => startGame(name, shape, selectedLevel)}
          />
        )}

        {ui.screen === 'levelSelect' && (
          <LevelSelectScreen
            currentLevel={selectedLevel}
            unlockedLevel={progression.unlockedLevel}
            onBack={() => setUi((s) => ({ ...clearOverlays(s), screen: 'menu' }))}
            onPlay={(lvl) => {
              const next = clampLevel(lvl);
              setSelectedLevel(next);
              const last = lastStartRef.current;
              if (last) startGame(last.name, last.shape, next);
              else setUi((s) => ({ ...clearOverlays(s), screen: 'menu' }));
            }}
          />
        )}

        {ui.screen === 'playing' && gameStateRef.current && (
          <>
            <Suspense fallback={<div className="text-white">Loading Renderer…</div>}>
              {settings.usePixi ? (
                <PixiGameCanvas gameStateRef={gameStateRef} inputEnabled={inputEnabled} />
              ) : (
                <GameCanvas
                  gameStateRef={gameStateRef}
                  width={viewport.w}
                  height={viewport.h}
                  enablePointerInput={inputEnabled}
                />
              )}
            </Suspense>

            <HUD gameStateRef={gameStateRef} isTouchInput={isTouch} />

            {isTouch && inputEnabled && (
              <MobileControls
                onMove={(x, y) => {
                  const state = gameStateRef.current;
                  if (!state) return;
                  state.player.targetPosition = {
                    x: state.player.position.x + x * 240,
                    y: state.player.position.y + y * 240,
                  };
                }}
                onAction={(btn) => {
                  const state = gameStateRef.current;
                  if (!state) return;
                  if (btn === 'skill') state.inputs.space = true;
                  if (btn === 'eject') state.inputs.w = true;
                }}
                onActionEnd={(btn) => {
                  const state = gameStateRef.current;
                  if (!state) return;
                  if (btn === 'skill') state.inputs.space = false;
                  if (btn === 'eject') state.inputs.w = false;
                }}
              />
            )}
          </>
        )}

        {ui.screen === 'gameOver' && (
          <GameOverScreen
            level={gameStateRef.current?.level ?? selectedLevel}
            result={gameStateRef.current?.result ?? 'lose'}
            canNext={(gameStateRef.current?.level ?? selectedLevel) < 20}
            onRetry={() => {
              const last = lastStartRef.current;
              if (!last) return setUi({ screen: 'menu', overlays: [] });
              startGame(last.name, last.shape, gameStateRef.current?.level ?? selectedLevel);
            }}
            onNext={() => {
              const last = lastStartRef.current;
              if (!last) return setUi({ screen: 'menu', overlays: [] });
              const next = clampLevel((gameStateRef.current?.level ?? selectedLevel) + 1);
              startGame(last.name, last.shape, next);
            }}
            onLevels={() => setUi({ screen: 'levelSelect', overlays: [] })}
          />
        )}

        {top?.type === 'pause' && (
          <PauseOverlay
            onResume={() => setUi((s) => popOverlay(s, 'pause'))}
            onRestart={() => {
              const last = lastStartRef.current;
              if (!last) return setUi({ screen: 'menu', overlays: [] });
              startGame(last.name, last.shape, gameStateRef.current?.level ?? selectedLevel);
            }}
            onQuit={() => {
              if (requestRef.current) cancelAnimationFrame(requestRef.current);
              requestRef.current = 0;
              gameStateRef.current = null;
              setUi({ screen: 'menu', overlays: [] });
            }}
            onSettings={() => setUi((s) => pushOverlay(s, { type: 'settings' }))}
          />
        )}

        {top?.type === 'settings' && (
          <SettingsOverlay
            usePixi={settings.usePixi}
            onTogglePixi={(next) => setSettings((s) => ({ ...s, usePixi: next }))}
            onClose={() => setUi((s) => popOverlay(s, 'settings'))}
          />
        )}

        {top?.type === 'tutorial' && (
          <TutorialOverlay
            step={top.step}
            onNext={() => setUi((s) => ({ ...s, overlays: [...s.overlays.slice(0, -1), { type: 'tutorial', step: top.step + 1 }] }))}
            onPrev={() => setUi((s) => ({ ...s, overlays: [...s.overlays.slice(0, -1), { type: 'tutorial', step: Math.max(0, top.step - 1) }] }))}
            onClose={(didFinish) => {
              setUi((s) => popOverlay(s, 'tutorial'));
              if (didFinish) setProgression((p) => ({ ...p, tutorialSeen: true }));
              const state = gameStateRef.current;
              if (state && uiRef.current.screen === 'playing') {
                if (!state.result && !state.tattooChoices) state.isPaused = false;
              }
            }}
          />
        )}

        {top?.type === 'tattooPick' && gameStateRef.current?.tattooChoices && (
          <TattooPicker choices={gameStateRef.current.tattooChoices} onSelect={handleTattooSelect} />
        )}
      </ErrorBoundary>
    </div>
  );
};

export default App;
