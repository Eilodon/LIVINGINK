import { useEffect, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { DebugHUD } from './components/DebugHUD';
import { NguHanhModule } from '@cjr/game-ngu-hanh';
import { WasmAdapter } from '@cjr/engine';
import { UISystem, GameUIState } from './game/systems/UISystem';
import './App.css';

import { LayoutContainer } from './ui/components/LayoutContainer';
import { MainMenuScreen } from './ui/screens/MainMenuScreen';
import { WorldMapScreen } from './ui/screens/WorldMapScreen';
import { GameHUD } from './ui/screens/GameHUD';
import { ShopScreen } from './ui/screens/ShopScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { DailyRewardsScreen } from './ui/screens/DailyRewardsScreen';
import { NetworkManager } from './network/NetworkManager';

function App() {
  const [wasmStatus, setWasmStatus] = useState<string>('Initializing WASM...');
  const [uiState, setUiState] = useState<GameUIState>(UISystem.getInstance().state);
  const [networkSeed, setNetworkSeed] = useState<string | null>(null);

  useEffect(() => {
    // 1. WASM Init (Adapter) - Global (Backing Store?)
    // Note: GameCanvas initializes its OWN GridSystem/WASM instance.
    // This adapter logic in App.tsx seems redundant but keeps it for now as "Core Engine Warmup" or similar.
    const adapter = new WasmAdapter();
    adapter.initialize()
      .then(() => {
        setWasmStatus('WASM Core: ACTIVE (Rust 🦀)');
        adapter.startLoop();
      })
      .catch((err: unknown) => {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setWasmStatus(`WASM Error: ${errorMessage}`);
      });

    // 2. Network Init
    const netManager = NetworkManager.getInstance();
    netManager.connect().then(seed => {
      console.log("App: Network Connected. Seed:", seed);
      setNetworkSeed(seed);
    }).catch(e => {
      console.error("App: Network Failed", e);
      // Fallback to "0" (Deterministic Offline) or random?
      // Let's fallback to "0" to indicate issue, or use random for offline play.
      // For Anti-Cheat task, we want strictness.
      // But for development, fallback is nice.
      setNetworkSeed(BigInt(Math.floor(Math.random() * 1000000)).toString());
    });

    // UI Sync
    const uiSystem = UISystem.getInstance();
    const onUpdate = (newState: GameUIState) => setUiState({ ...newState });
    uiSystem.on('update', onUpdate);

    // Cleanup function to prevent memory leaks
    return () => {
      adapter.stopLoop();
      adapter.cleanup?.();
      uiSystem.off('update', onUpdate);
      // netManager.disconnect()?
    };
  }, []);

  return (
    <LayoutContainer>
      {uiState.currentScreen === 'MAIN_MENU' && <MainMenuScreen />}
      {uiState.currentScreen === 'LEVEL_SELECT' && <WorldMapScreen />}
      {uiState.currentScreen === 'SHOP' && <ShopScreen />}
      {uiState.currentScreen === 'PROFILE' && <ProfileScreen />}
      {uiState.currentScreen === 'SETTINGS' && <SettingsScreen />}
      {uiState.currentScreen === 'DAILY_REWARDS' && <DailyRewardsScreen />}

      {uiState.currentScreen === 'GAME' && (
        <>
          {networkSeed ? (
            <GameCanvas seed={networkSeed} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white font-mono bg-black/80 z-50">
              Connecting to Server Authority...
            </div>
          )}
          <GameHUD />
          <DebugHUD />
        </>
      )}
    </LayoutContainer>
  );
}

export default App;
