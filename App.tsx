import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { GamePhase, GameState, Faction, MutationChoice, MutationId, PlayerProfile } from './types';
import { createPlayer, createBot, createFood, createCreeps, createLandmarks, createZoneHazards, updateGameState, createGameEngine } from './services/engine';
import { audioEngine } from './services/audio/AudioEngine';
import { vfxManager } from './services/vfx/VFXManager';
import { WORLD_WIDTH, WORLD_HEIGHT, INITIAL_ZONE_RADIUS, BOT_COUNT, FOOD_COUNT, BOSS_RESPAWN_TIME, DUST_STORM_INTERVAL } from './constants';
import MainMenu from './components/MainMenu';
import HUD from './components/HUD';
import MobileControls from './components/MobileControls';
import MutationPicker from './components/MutationPicker';
import BloodlinePicker from './components/BloodlinePicker';
import { applyMutation, getAllMutationIds, getMutationById } from './services/mutations';
import { applyMatchResult, loadProfile, saveProfile } from './services/profile';
import { BloodlineId, applyBloodlineStats } from './services/bloodlines';
import { checkForLegendaryEvolution, applyLegendaryEvolution } from './services/legendaryEvolutions';

const totalMutationCount = getAllMutationIds().length;
const PixiGameCanvas = React.lazy(() => import('./components/PixiGameCanvas'));

const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.Menu);
  const [isTouchInput, setIsTouchInput] = useState(false);
  const [mutationChoices, setMutationChoices] = useState<MutationChoice[] | null>(null);
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [newUnlocks, setNewUnlocks] = useState<MutationId[]>([]);
  const [showBloodlinePicker, setShowBloodlinePicker] = useState(false);
  const [selectedBloodline, setSelectedBloodline] = useState<BloodlineId | null>(null);
  const [pendingGameStart, setPendingGameStart] = useState<{ name: string; faction: Faction } | null>(null);
  const phaseRef = useRef<GamePhase>(phase);
  // GameStateRef holds the TRUTH. We do not sync this to React state every frame.
  const gameStateRef = useRef<GameState | null>(null);
  const profileRef = useRef<PlayerProfile>(profile);

  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const mutationKeyRef = useRef<string | null>(null);
  const autoPausedRef = useRef(false);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const setPhaseSafe = (next: GamePhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const preloadPixiCanvas = () => {
    void import('./components/PixiGameCanvas');
  };

  const handleStartGame = (playerName: string, faction: Faction) => {
    // Show bloodline picker before starting game
    setPendingGameStart({ name: playerName, faction });
    setShowBloodlinePicker(true);
  };

  const handleBloodlineSelect = (bloodlineId: BloodlineId) => {
    setSelectedBloodline(bloodlineId);
    setShowBloodlinePicker(false);

    if (pendingGameStart) {
      initGame(pendingGameStart.name, pendingGameStart.faction, bloodlineId);
      setPendingGameStart(null);
    }
  };

  const handleBloodlineBack = () => {
    setShowBloodlinePicker(false);
    setPendingGameStart(null);
  };

  const initGame = (playerName: string, faction: Faction, bloodlineId: BloodlineId) => {
    setMutationChoices(null);
    mutationKeyRef.current = null;
    setNewUnlocks([]);

    // Initialize Audio Engine on user interaction
    audioEngine.initialize().then(() => {
      audioEngine.resume();
      audioEngine.startBGM();
      audioEngine.setBGMIntensity(1);
    });

    const player = createPlayer(playerName, faction, 0);

    // Apply bloodline stats and passives
    applyBloodlineStats(player, bloodlineId);
    (player as any).bloodline = bloodlineId;

    const bots = Array.from({ length: BOT_COUNT }).map((_, i) => createBot(i.toString(), 0));
    const food = Array.from({ length: FOOD_COUNT }).map(() => createFood());
    const creeps = createCreeps();
    const landmarks = createLandmarks();
    const hazards = createZoneHazards();

    gameStateRef.current = {
      player,
      bots,
      creeps,
      boss: null,
      food,
      powerUps: [],
      hazards,
      landmarks,
      particles: [],
      projectiles: [],
      floatingTexts: [],
      lavaZones: [],
      delayedActions: [],
      worldSize: { x: WORLD_WIDTH, y: WORLD_HEIGHT },
      zoneRadius: INITIAL_ZONE_RADIUS,
      gameTime: 0,
      currentRound: 1, // Start Round 1
      camera: player.position,
      shakeIntensity: 0,
      kingId: null,
      relicId: null,
      relicTimer: 8,
      mutationChoices: null,
      unlockedMutations: profileRef.current.unlockedMutations,
      isPaused: false,
      hazardTimers: {
        lightning: 6,
        geyser: 4,
        icicle: 6,
        powerUpFire: 12,
        powerUpWood: 10,
        powerUpWater: 14,
        powerUpMetal: 12,
        powerUpEarth: 16,
        bossRespawn: BOSS_RESPAWN_TIME,
        creepRespawn: 20,
        dustStorm: DUST_STORM_INTERVAL,
        dustStormActive: false,
      },
      inputs: { space: false, w: false },
      // S-TIER: Each game instance owns its own engine
      engine: createGameEngine()
    };

    setPhaseSafe(GamePhase.Playing);
    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const gameLoop = (time: number) => {
    if (phaseRef.current !== GamePhase.Playing) return;

    const dtRaw = (time - lastTimeRef.current) / 1000;
    const dt = Math.min(0.05, Math.max(0, dtRaw));
    lastTimeRef.current = time;

    if (gameStateRef.current) {
      // 0. Update VFX Manager (handles time scaling for slow-mo)
      vfxManager.update(dt);
      const timeScale = vfxManager.getTimeScale();

      // 1. Update Physics / Game Logic (with time scaling)
      // Note: updateGameState mutates the object for performance in this architecture
      // (engine.ts was updated to support this pattern efficiently)
      const newState = updateGameState(gameStateRef.current, dt * timeScale);
      gameStateRef.current = newState;

      const pending = newState.mutationChoices;
      if (pending && pending.length) {
        const key = pending.map((choice) => choice.id).join('|');
        if (mutationKeyRef.current !== key) {
          mutationKeyRef.current = key;
          setMutationChoices(pending);
        }
      } else if (mutationKeyRef.current) {
        mutationKeyRef.current = null;
        setMutationChoices(null);
      }

      // 2. Check Game Over
      if (newState.player.isDead) {
        const summary = {
          score: Math.floor(newState.player.score),
          kills: newState.player.kills,
        };
        const result = applyMatchResult(profileRef.current, summary);
        profileRef.current = result.profile;
        setProfile(result.profile);
        saveProfile(result.profile);
        setNewUnlocks(result.newlyUnlocked);
        setPhaseSafe(GamePhase.GameOver);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return;
      }

      // CRITICAL ARCHITECTURE CHANGE: 
      // We do NOT call setUiState here. HUD reads from gameStateRef directly via its own loop.
      // This saves 60 React Reconciliations per second.
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const handleMouseMove = (x: number, y: number) => {
    if (gameStateRef.current) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      const worldX = gameStateRef.current.camera.x + (x - screenWidth / 2);
      const worldY = gameStateRef.current.camera.y + (y - screenHeight / 2);
      const player = gameStateRef.current.player;
      const smoothing = 0.22;
      player.targetPosition = {
        x: player.targetPosition.x + (worldX - player.targetPosition.x) * smoothing,
        y: player.targetPosition.y + (worldY - player.targetPosition.y) * smoothing,
      };
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!gameStateRef.current) return;
    if (e.code === 'Space') {
      gameStateRef.current.inputs.space = true;
    }
    if (e.code === 'KeyW') {
      gameStateRef.current.inputs.w = true;
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (!gameStateRef.current) return;
    if (e.code === 'Space') {
      gameStateRef.current.inputs.space = false;
    }
    if (e.code === 'KeyW') {
      gameStateRef.current.inputs.w = false;
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    const pauseGame = () => {
      const state = gameStateRef.current;
      if (!state) return;
      if (!state.isPaused) autoPausedRef.current = true;
      state.isPaused = true;
      state.inputs.space = false;
      state.inputs.w = false;
    };

    const resumeGame = () => {
      const state = gameStateRef.current;
      if (!state) return;
      lastTimeRef.current = performance.now();
      if (!autoPausedRef.current) return;
      autoPausedRef.current = false;
      if (!state.mutationChoices) state.isPaused = false;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) pauseGame();
      else resumeGame();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', pauseGame);
    window.addEventListener('focus', resumeGame);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', pauseGame);
      window.removeEventListener('focus', resumeGame);
    };
  }, []);

  useEffect(() => {
    const detectTouch = () => {
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
      setIsTouchInput(hasCoarsePointer || hasTouch || window.innerWidth < 900);
    };
    detectTouch();
    window.addEventListener('resize', detectTouch);
    return () => window.removeEventListener('resize', detectTouch);
  }, []);

  const handleStickMove = (x: number, y: number) => {
    if (!gameStateRef.current) return;
    const player = gameStateRef.current.player;
    const magnitude = Math.min(1, Math.hypot(x, y));
    if (magnitude === 0) {
      player.targetPosition = { ...player.position };
      return;
    }
    const targetDistance = 180;
    const curved = Math.pow(magnitude, 1.4);
    const dirX = x / magnitude;
    const dirY = y / magnitude;
    player.targetPosition = {
      x: player.position.x + dirX * targetDistance * curved,
      y: player.position.y + dirY * targetDistance * curved,
    };
  };

  const handleSkillStart = () => {
    if (gameStateRef.current) gameStateRef.current.inputs.space = true;
  };

  const handleSkillEnd = () => {
    if (gameStateRef.current) gameStateRef.current.inputs.space = false;
  };

  const handleEjectStart = () => {
    if (gameStateRef.current) gameStateRef.current.inputs.w = true;
  };

  const handleEjectEnd = () => {
    if (gameStateRef.current) gameStateRef.current.inputs.w = false;
  };

  const handleMutationSelect = (id: MutationId) => {
    const state = gameStateRef.current;
    if (!state) return;

    applyMutation(state.player, id);

    // Check for legendary evolution after mutation
    const legendaryEvolution = checkForLegendaryEvolution(state.player);
    if (legendaryEvolution) {
      applyLegendaryEvolution(state.player, legendaryEvolution.id);
    }

    const mutation = getMutationById(id);
    if (mutation) {
      state.floatingTexts.push({
        id: Math.random().toString(),
        position: { ...state.player.position },
        text: mutation.name,
        color: '#60a5fa',
        size: 20,
        life: 2.5,
        velocity: { x: 0, y: -2 }
      });
    }
    state.mutationChoices = null;
    state.isPaused = false;
    setMutationChoices(null);
  };

  const newUnlockNames = useMemo(
    () => newUnlocks.map((id) => getMutationById(id)?.name || String(id)),
    [newUnlocks]
  );

  return (
    <div className="w-full h-screen bg-slate-900 relative overflow-hidden select-none">
      {phase === GamePhase.Menu && !showBloodlinePicker && (
        <MainMenu onStart={handleStartGame} onPreload={preloadPixiCanvas} profile={profile} totalMutations={totalMutationCount} />
      )}

      {showBloodlinePicker && (
        <BloodlinePicker
          profile={profile}
          onSelect={handleBloodlineSelect}
          onBack={handleBloodlineBack}
        />
      )}

      {phase === GamePhase.Playing && gameStateRef.current && (
        <>
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-white">Loading...</div>}>
            <PixiGameCanvas
              gameState={gameStateRef.current}
              onMouseMove={handleMouseMove}
              onMouseDown={() => {
                if (gameStateRef.current) gameStateRef.current.inputs.space = true;
              }}
              onMouseUp={() => {
                if (gameStateRef.current) gameStateRef.current.inputs.space = false;
              }}
              enablePointerInput={!isTouchInput}
            />
          </Suspense>
          {/* HUD now accepts the Ref, not a state object */}
          <HUD gameStateRef={gameStateRef} isTouchInput={isTouchInput} />
          {isTouchInput && (
            <MobileControls
              onMove={handleStickMove}
              onSkillStart={handleSkillStart}
              onSkillEnd={handleSkillEnd}
              onEjectStart={handleEjectStart}
              onEjectEnd={handleEjectEnd}
            />
          )}
          {mutationChoices && (
            <MutationPicker choices={mutationChoices} onSelect={handleMutationSelect} />
          )}
        </>
      )}

      {phase === GamePhase.GameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50">
          <div className="text-center">
            <h1 className="text-6xl text-red-600 font-fantasy mb-4">YOU DIED</h1>
            <p className="text-white text-xl mb-8">
              Score: {gameStateRef.current?.player.score.toFixed(0)} <br />
              Kills: {gameStateRef.current?.player.kills} <br />
              High Score: {profile.highScore.toFixed(0)}
            </p>
            {newUnlockNames.length > 0 && (
              <div className="mb-6 text-slate-200 text-sm">
                <div className="text-yellow-400 font-bold mb-2">New Unlocks</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {newUnlockNames.map((name) => (
                    <span key={name} className="px-3 py-1 rounded-full bg-slate-800 border border-slate-600">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => setPhaseSafe(GamePhase.Menu)}
              className="px-8 py-3 bg-white text-black font-bold rounded hover:bg-gray-200"
            >
              RETURN TO MENU
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
