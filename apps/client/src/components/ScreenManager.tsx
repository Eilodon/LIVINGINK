import React, { useState, useEffect, useRef } from 'react';
import ErrorBoundary from './ErrorBoundary';
import MainMenu from './MainMenu';
import HUD from './HUD';
import MobileControls from './MobileControls';
import GameOverScreen from './screens/GameOverScreen';
import LevelSelectScreen from './screens/LevelSelectScreen';
import MatchmakingScreen from './screens/MatchmakingScreen';
import TournamentLobbyScreen from './screens/TournamentLobbyScreen';
import BootScreen from './screens/BootScreen';
import GameCanvas from './GameCanvas';
import { UiOverlayManager } from './UiOverlayManager';
import { useGameSession } from '../hooks/useGameSession';
import { isWebGLSupported } from '../game/renderer/WebGLCheck';
import { inputManager } from '../game/input/InputManager';

// Lazy load Pixi Canvas for performance
const PixiGameCanvas = React.lazy(() => import('./PixiGameCanvas'));

// EIDOLON-V: Preload PixiGameCanvas module immediately (before render)
// This eliminates the "Summoning..." flash when switching to Pixi renderer
const pixiPreloadPromise = import('./PixiGameCanvas');

// EIDOLON-V: Custom hook for reactive window dimensions
const useWindowDimensions = () => {
  const [dimensions, setDimensions] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  useEffect(() => {
    // Throttled resize handler to prevent excessive re-renders
    let rafId: number | null = null;
    const handleResize = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        setDimensions({ w: window.innerWidth, h: window.innerHeight });
        rafId = null;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return dimensions;
};

interface ScreenManagerProps {
  session: ReturnType<typeof useGameSession>;
}

const GameWorldLayer: React.FC<{ session: ScreenManagerProps['session'] }> = ({ session }) => {
  const { ui, refs, settings } = session;
  const isPlaying = ui.screen === 'playing' && refs.gameState.current;
  const inputEnabled = isPlaying && ui.overlays.length === 0;

  // EIDOLON-V: Reactive window dimensions
  const dimensions = useWindowDimensions();

  // EIDOLON-V FIX: Auto-fallback if WebGL is missing
  const isWebGL = React.useMemo(() => isWebGLSupported(), []);
  const usePixi = settings.usePixi && isWebGL;

  // EIDOLON-V: Cache input scale to avoid recalculation per mousemove
  const inputScaleRef = useRef(Math.min(dimensions.w, dimensions.h) / 2);
  useEffect(() => {
    inputScaleRef.current = Math.min(dimensions.w, dimensions.h) / 2;
  }, [dimensions.w, dimensions.h]);

  if (!isPlaying) return null;

  return (
    <React.Suspense
      fallback={
        <div className="absolute inset-0 flex items-center justify-center bg-ink-950 text-gold-400">
          Summoning...
        </div>
      }
    >
      {usePixi ? (
        <ErrorBoundary
          fallback={
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950">
              <div className="text-center">
                <div className="text-red-400 text-xl mb-4">PixiJS Failed to Load</div>
                <div className="text-mist-400 text-sm mb-4">Falling back to Canvas renderer...</div>
                <button
                  onClick={() => session.actions.ui.togglePixi(false)}
                  className="px-4 py-2 bg-gold-400 text-ink-950 rounded font-bold"
                >
                  Use Canvas
                </button>
              </div>
            </div>
          }
        >
          <PixiGameCanvas
            gameStateRef={refs.gameState}
            inputEnabled={!!inputEnabled}
            alphaRef={refs.alpha}
          />
        </ErrorBoundary>
      ) : (
        <GameCanvas
          gameStateRef={refs.gameState}
          alphaRef={refs.alpha}
          width={dimensions.w}
          height={dimensions.h}
          enablePointerInput={!!inputEnabled}
          onMouseMove={(x, y) => {
            // EIDOLON-V: Use cached scale (updated on resize, not per mousemove)
            inputManager.setJoystick(x / inputScaleRef.current, y / inputScaleRef.current);
          }}
          onMouseDown={() => inputManager.setButton('skill', true)}
          onMouseUp={() => inputManager.setButton('skill', false)}
        />
      )}
    </React.Suspense>
  );
};

const UILayer: React.FC<{ session: ScreenManagerProps['session'] }> = ({ session }) => {
  const { ui, refs, isTouch } = session;
  const isPlaying = ui.screen === 'playing' && refs.gameState.current;

  if (!isPlaying) return null;

  return (
    <>
      <HUD gameStateRef={refs.gameState} isTouchInput={isTouch} />
      {isTouch && <MobileControls />}
    </>
  );
};

const ScreensLayer: React.FC<{ session: ScreenManagerProps['session'] }> = ({ session }) => {
  const { ui, state, actions, meta, settings, refs } = session;

  return (
    <div className="absolute inset-0 pointer-events-none [&>*]:pointer-events-auto">
      {ui.screen === 'boot' && <BootScreen />}

      {ui.screen === 'menu' && (
        <MainMenu
          level={meta.selectedLevel}
          unlockedLevel={session.progression.unlockedLevel}
          usePixi={settings.usePixi}
          useMultiplayer={settings.useMultiplayer}
          networkStatus={meta.networkStatus || 'offline'}
          name={meta.menuName}
          shape={meta.menuShape}
          onStart={(n, s) => actions.game.start(n, s, meta.selectedLevel)}
          onNameChange={actions.meta.setName}
          onShapeChange={actions.meta.setShape}
          onTogglePixi={actions.ui.togglePixi}
          onOpenLevels={() => actions.ui.setScreen('levelSelect')}
          onOpenSettings={() => actions.ui.pushOverlay({ type: 'settings' })}
          onOpenTutorial={() => actions.ui.pushOverlay({ type: 'tutorial', step: 0 })}
          onOpenMatchmaking={() => actions.ui.setScreen('matchmaking')}
          onOpenTournament={() => actions.ui.setScreen('tournament')}
        />
      )}

      {ui.screen === 'levelSelect' && (
        <LevelSelectScreen
          currentLevel={meta.selectedLevel}
          unlockedLevel={session.progression.unlockedLevel}
          onBack={() => actions.ui.setScreen('menu')}
          onPlay={l => {
            actions.meta.setLevel(l);
            actions.ui.setScreen('menu');
          }}
        />
      )}

      {ui.screen === 'matchmaking' && (
        <MatchmakingScreen
          name={meta.menuName}
          shape={meta.menuShape}
          region={meta.matchmakingRegion}
          status={meta.matchmaking.status}
          queuedAt={meta.matchmaking.queuedAt}
          networkStatus={meta.networkStatus}
          onRegionChange={actions.ui.setMatchmakingRegion}
          onQueue={actions.meta.startQueue}
          onCancel={actions.meta.cancelQueue}
          onBack={() => {
            actions.meta.cancelQueue();
            actions.ui.setScreen('menu');
          }}
          onEnterMatch={() => {
            actions.meta.cancelQueue();
            actions.ui.toggleMultiplayer(true);
            actions.game.start(meta.menuName, meta.menuShape, meta.selectedLevel, true);
          }}
        />
      )}

      {ui.screen === 'tournament' && (
        <TournamentLobbyScreen
          queue={meta.tournamentQueue}
          onQueue={actions.meta.startTournamentQueue}
          onCancel={actions.meta.cancelTournamentQueue}
          onBack={() => {
            actions.meta.cancelTournamentQueue();
            actions.ui.setScreen('menu');
          }}
        />
      )}

      {ui.screen === 'gameOver' && (
        <GameOverScreen
          level={state.level ?? meta.selectedLevel}
          result={state.lastResult ?? 'lose'}
          canNext={(state.level ?? meta.selectedLevel) < 20}
          onRetry={actions.game.retry}
          onNext={actions.game.nextLevel}
          onLevels={() => actions.ui.setScreen('levelSelect')}
          onHome={actions.ui.returnToMenu}
        />
      )}

      <UiOverlayManager
        overlays={ui.overlays}
        actions={actions.ui}
        gameStateRef={refs.gameState}
        settings={settings}
      />
    </div>
  );
};

export const ScreenManager: React.FC<ScreenManagerProps> = ({ session }) => {
  return (
    <>
      <GameWorldLayer session={session} />
      <UILayer session={session} />
      <ScreensLayer session={session} />
    </>
  );
};
