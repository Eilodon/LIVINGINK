import React, { Suspense, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { useGameSession } from './hooks/useGameSession';
import { UiOverlayManager } from './components/UiOverlayManager';
import { inputManager } from './services/input/InputManager';
import MainMenu from './components/MainMenu';
import HUD from './components/HUD';
import MobileControls from './components/MobileControls';
import GameOverScreen from './components/screens/GameOverScreen';
import LevelSelectScreen from './components/screens/LevelSelectScreen';
import MatchmakingScreen from './components/screens/MatchmakingScreen';
import TournamentLobbyScreen from './components/screens/TournamentLobbyScreen';
import BootScreen from './components/screens/BootScreen';
import GameCanvas from './components/GameCanvas';

// Lazy load Pixi Canvas
const PixiGameCanvas = React.lazy(() => import('./components/PixiGameCanvas'));

const App: React.FC = () => {
  const session = useGameSession();
  const { ui, state, actions, refs, settings, isTouch, meta } = session;

  const isPlaying = ui.screen === 'playing' && refs.gameState.current;
  const inputEnabled = isPlaying && ui.overlays.length === 0;

  // Use Pixi flag
  const usePixi = settings.usePixi;

  // Initialize Input Manager
  useEffect(() => {
    inputManager.init();
  }, []);

  return (
    <div className="app-shell select-none relative w-full h-full bg-ink-950 overflow-hidden">
      <ErrorBoundary>

        {/* GAME WORLD LAYER */}
        {isPlaying && (
          <Suspense fallback={<div className="absolute center text-gold-400">Summoning...</div>}>
            {usePixi ? (
              <PixiGameCanvas
                gameStateRef={refs.gameState}
                inputEnabled={inputEnabled}
                alphaRef={refs.alpha}
              />
            ) : (
              <GameCanvas
                gameStateRef={refs.gameState}
                width={window.innerWidth}
                height={window.innerHeight}
                enablePointerInput={inputEnabled}
                onMouseMove={(x, y) => {
                  // GameCanvas legacy mouse handling
                }}
              />
            )}
          </Suspense>
        )}

        {/* UI LAYER */}
        {isPlaying && (
          <>
            <HUD gameStateRef={refs.gameState} isTouchInput={isTouch} />
            {isTouch && <MobileControls />}
          </>
        )}

        {/* SCREENS */}
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
              onPlay={(l) => { actions.meta.setLevel(l); actions.ui.setScreen('menu'); }}
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
              onBack={() => { actions.meta.cancelQueue(); actions.ui.setScreen('menu'); }}
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
              onBack={() => { actions.meta.cancelTournamentQueue(); actions.ui.setScreen('menu'); }}
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

      </ErrorBoundary>
    </div>
  );
};

export default App;
