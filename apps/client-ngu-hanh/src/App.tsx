import { useEffect, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { NguHanhModule } from '@cjr/game-ngu-hanh';
import { WasmAdapter } from '@cjr/engine';
import { BossUI } from './ui/BossUI';
import { MetagameUI } from './ui/MetagameUI';
import { BattlePassUI } from './components/BattlePassUI'; // Import
import { LevelSelect } from './ui/LevelSelect';
import { UISystem, GameUIState } from './game/systems/UISystem';
import './App.css';

console.log(new NguHanhModule());

function App() {
  const [wasmStatus, setWasmStatus] = useState<string>('Initializing WASM...');
  const [uiState, setUiState] = useState<GameUIState>(UISystem.getInstance().state);

  useEffect(() => {
    // WASM Init
    const adapter = new WasmAdapter();
    adapter.initialize()
      .then(() => {
        setWasmStatus('WASM Core: ACTIVE (Rust 🦀)');
        adapter.startLoop();
      })
      .catch((err: any) => {
        console.error(err);
        setWasmStatus(`WASM Error: ${err.message}`);
      });

    // UI Sync
    const uiSystem = UISystem.getInstance();
    const onUpdate = (newState: GameUIState) => setUiState({ ...newState });
    uiSystem.on('update', onUpdate);
    return () => {
      uiSystem.off('update', onUpdate);
    };
  }, []);

  return (
    <div className="app-container">
      {uiState.currentScreen === 'LEVEL_SELECT' && <LevelSelect />}

      {uiState.currentScreen === 'GAME' && (
        <>
          <GameCanvas />
          <BossUI />
          <MetagameUI />
          <BattlePassUI /> {/* Render */}
          <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none' }}>
            <h1>Ngũ Hành Match-3 (Client Prototype)</h1>
            <p>PixiJS + React + ECS</p>
            <p style={{ color: wasmStatus.includes('Error') ? 'red' : '#4ade80', fontWeight: 'bold' }}>
              {wasmStatus}
            </p>
          </div>
          {/* Back Button for testing */}
          <button
            style={{ position: 'absolute', top: 20, right: 20, zIndex: 1000 }}
            onClick={() => UISystem.getInstance().switchScreen('LEVEL_SELECT')}
          >
            Exit Level
          </button>
        </>
      )}
    </div>
  );
}

export default App;
