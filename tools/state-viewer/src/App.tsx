import { useState, useEffect } from 'react';
import { useStateSnapshot, EntitySnapshot, GameSnapshot } from './hooks/useStateSnapshot';
import { WorldView } from './components/WorldView';
import { EntityInspector } from './components/EntityInspector';
import { EntityTree } from './components/EntityTree';
import { WatchPanel } from './components/WatchPanel';
import { Timeline } from './components/Timeline';
import './App.css';

interface Watch {
  id: string;
  entityIndex: number;
  path: string;
  value: unknown;
}

function App() {
  const { snapshot: liveSnapshot, isConnected } = useStateSnapshot();
  const [selectedEntity, setSelectedEntity] = useState<EntitySnapshot | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [snapshots, setSnapshots] = useState<GameSnapshot[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);

  // Store snapshots for time travel
  useEffect(() => {
    if (liveSnapshot && !isPaused) {
      setSnapshots(prev => {
        const next = [...prev, liveSnapshot];
        return next.slice(-600); // Keep last 600 frames (10 sec @ 60fps)
      });
      setCurrentFrame(liveSnapshot.frame);
    }
  }, [liveSnapshot, isPaused]);

  const displaySnapshot = isPaused 
    ? snapshots.find(s => s.frame === currentFrame) || liveSnapshot
    : liveSnapshot;

  const filteredEntities = displaySnapshot?.entities.filter(e => 
    filter === 'all' || e.type === filter
  ) || [];

  const handleAddWatch = (entityIndex: number, path: string) => {
    const id = `${entityIndex}-${path}-${Date.now()}`;
    setWatches(prev => [...prev, { id, entityIndex, path, value: null }]);
  };

  const handleRemoveWatch = (id: string) => {
    setWatches(prev => prev.filter(w => w.id !== id));
  };

  const handleClearWatches = () => setWatches([]);

  return (
    <div className="state-viewer">
      <header>
        <h1>🔍 State Viewer</h1>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </header>

      <Timeline 
        snapshots={snapshots}
        currentFrame={currentFrame}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onStep={() => setCurrentFrame(f => Math.min(f + 1, snapshots[snapshots.length - 1]?.frame || f))}
        onSeek={setCurrentFrame}
      />

      <main>
        <div className="left-panel">
          <EntityTree 
            entities={filteredEntities}
            selectedEntity={selectedEntity}
            onSelectEntity={setSelectedEntity}
          />
          
          <WatchPanel 
            watches={watches}
            entities={displaySnapshot?.entities || []}
            onAddWatch={handleAddWatch}
            onRemoveWatch={handleRemoveWatch}
            onClearAll={handleClearWatches}
          />
        </div>

        <div className="world-panel">
          <WorldView 
            snapshot={displaySnapshot}
            selectedEntity={selectedEntity}
            onSelectEntity={setSelectedEntity}
          />
          
          <div className="filters">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              title="Filter entities by type"
            >
              <option value="all">All Entities</option>
              <option value="player">Players</option>
              <option value="bot">Bots</option>
              <option value="food">Food</option>
              <option value="boss">Boss</option>
            </select>
          </div>

          {displaySnapshot && (
            <div className="stats-summary">
              <div>Frame: {displaySnapshot.frame}</div>
              <div>Entities: {filteredEntities.length}</div>
              <div>Game Time: {displaySnapshot.gameState.gameTime.toFixed(1)}s</div>
              <div>Boss: {displaySnapshot.gameState.bossActive ? 'Active' : 'Inactive'}</div>
            </div>
          )}
        </div>

        <EntityInspector entity={selectedEntity} />
      </main>
    </div>
  );
}

export default App;
