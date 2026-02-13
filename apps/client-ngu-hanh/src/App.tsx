import { useEffect, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { NguHanhModule } from '@cjr/game-ngu-hanh';
import { WasmAdapter } from '@cjr/engine';
import './App.css';

console.log(new NguHanhModule());

function App() {
  const [wasmStatus, setWasmStatus] = useState<string>('Initializing WASM...');

  useEffect(() => {
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
  }, []);

  return (
    <div className="app-container">
      <GameCanvas />
      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none' }}>
        <h1>Ngũ Hành Match-3 (Client Prototype)</h1>
        <p>PixiJS + React + ECS</p>
        <p style={{ color: wasmStatus.includes('Error') ? 'red' : '#4ade80', fontWeight: 'bold' }}>
          {wasmStatus}
        </p>
      </div>
    </div>
  );
}

export default App;
