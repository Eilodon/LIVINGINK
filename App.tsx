
import React, { Suspense, useState, useEffect, useRef } from 'react';
import { GamePhase, GameState, TattooId, PlayerProfile } from './types';
import { ShapeId } from './services/cjr/cjrTypes';
import { createInitialState, updateGameState } from './services/engine';
import { networkClient } from './services/networking/NetworkClient';


import MainMenu from './components/MainMenu';
import HUD from './components/HUD';
import MobileControls from './components/MobileControls';
import GameCanvas from './components/GameCanvas';
import TattooPicker from './components/TattooPicker';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load heavy Pixi
const PixiGameCanvas = React.lazy(() => import('./components/PixiGameCanvas'));

const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.Menu);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Settings
  const [usePixi, setUsePixi] = useState(true); // Default to Pixi for "Full Power"
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleStartGame = (name: string, shape: ShapeId) => {
    const state = createInitialState();
    state.player.name = name;
    state.player.shape = shape;

    networkClient.setLocalState(state);

    // Connect to server if not connected (Logic could be refined to connect before start)
    networkClient.connect(name, shape);

    gameStateRef.current = state;
    setGameState(state);
    setPhase(GamePhase.Playing);

    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const gameLoop = (time: number) => {
    if (phase !== GamePhase.Playing || !gameStateRef.current) return;

    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    // Fixed time step cap
    const safeDt = Math.min(dt, 0.1);

    if (!gameStateRef.current.isPaused) {
      updateGameState(gameStateRef.current, safeDt);
    }

    // Force re-render for React UI (HUD) occasionally, or use ref for high perf
    // In React 18+ automatic batching helps. 
    // Ideally HUD reads from Ref directly via useFrame or interval, but here simply:
    setGameState({ ...gameStateRef.current }); // Trigger React update

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Input Handling (Keyboard)
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (!gameStateRef.current) return;
      if (e.code === 'Space') gameStateRef.current.inputs.space = true;
      if (e.code === 'KeyW') gameStateRef.current.inputs.w = true;
    };
    const handleUp = (e: KeyboardEvent) => {
      if (!gameStateRef.current) return;
      if (e.code === 'Space') gameStateRef.current.inputs.space = false;
      if (e.code === 'KeyW') gameStateRef.current.inputs.w = false;
    };

    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  const handleTattooSelect = (id: TattooId) => {
    if (gameStateRef.current) {
      // Apply tattoo logic (should be handled by engine/applyTattoo really, 
      // but for now we just push to unlocked and close choice)
      import('./services/cjr/tattoos').then(({ applyTattoo }) => {
        if (gameStateRef.current) {
          applyTattoo(gameStateRef.current.player, id);
          gameStateRef.current.tattooChoices = null;
          gameStateRef.current.isPaused = false;
        }
      });
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-black select-none font-sans">
      <ErrorBoundary>
        {phase === GamePhase.Menu && (
          <MainMenu onStart={handleStartGame} />
        )}

        {phase === GamePhase.Playing && gameState && (
          <>
            <Suspense fallback={<div className="text-white">Loading Engine...</div>}>
              {usePixi ? (
                <PixiGameCanvas gameState={gameState} isTouchInput={isTouch} />
              ) : (
                <GameCanvas gameState={gameState} width={window.innerWidth} height={window.innerHeight} />
              )}
            </Suspense>

            <HUD gameStateRef={gameStateRef} isTouchInput={isTouch} />

            {isTouch && (
              <MobileControls
                onMove={(x, y) => {
                  if (gameStateRef.current) gameStateRef.current.player.targetPosition = {
                    x: gameStateRef.current.player.position.x + x * 100,
                    y: gameStateRef.current.player.position.y + y * 100
                  };
                }}
                onAction={(btn) => {
                  if (gameStateRef.current) {
                    if (btn === 'skill') gameStateRef.current.inputs.space = true;
                    if (btn === 'eject') gameStateRef.current.inputs.w = true;
                  }
                }}
                onActionEnd={(btn) => {
                  if (gameStateRef.current) {
                    if (btn === 'skill') gameStateRef.current.inputs.space = false;
                    if (btn === 'eject') gameStateRef.current.inputs.w = false;
                  }
                }}
              />
            )}

            {gameState.tattooChoices && (
              <TattooPicker
                choices={gameState.tattooChoices}
                onSelect={handleTattooSelect}
              />
            )}
          </>
        )}
      </ErrorBoundary>
    </div>
  );
};

export default App;
