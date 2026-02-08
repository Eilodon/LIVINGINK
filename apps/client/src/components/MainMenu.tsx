import React from 'react';
import { ShapeId } from '../game/cjr/cjrTypes';

interface MainMenuProps {
  level: number;
  unlockedLevel: number;
  _usePixi?: boolean;
  useMultiplayer: boolean;
  networkStatus: 'offline' | 'connecting' | 'online' | 'reconnecting' | 'error' | 'offline_mode';
  _name?: string;
  _shape?: ShapeId;
  onTogglePixi: (usePixi: boolean) => void;
  onOpenLevels: () => void;
  onOpenTutorial: () => void;
  onOpenSettings: () => void;
  onOpenMatchmaking: () => void;
  onOpenTournament: () => void;
  _onStart?: (name: string, shape: ShapeId) => void;
  _onNameChange?: (name: string) => void;
  _onShapeChange?: (shape: ShapeId) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({
  level,
  unlockedLevel,
  _usePixi: usePixi = false,
  useMultiplayer,
  networkStatus,
  _name: name = '',
  _shape: shape = 'circle',
  onTogglePixi,
  onOpenLevels,
  onOpenTutorial,
  onOpenSettings,
  onOpenMatchmaking,
  onOpenTournament,
  _onStart: onStart = () => { },
  _onNameChange: onNameChange = () => { },
  _onShapeChange: onShapeChange = () => { },
}) => {
  const handleStart = () => {
    if (!name.trim()) return;
    onStart(name, shape);
  };

  const statusLabel = () => {
    if (networkStatus === 'online') return 'ONLINE';
    if (networkStatus === 'connecting') return 'CONNECTING';
    if (networkStatus === 'reconnecting') return 'RECONNECTING';
    if (networkStatus === 'error') return 'ERROR';
    return 'OFFLINE';
  };

  const statusColor = () => {
    if (networkStatus === 'online') return 'text-emerald-300';
    if (networkStatus === 'connecting' || networkStatus === 'reconnecting') return 'text-amber-300';
    if (networkStatus === 'error') return 'text-rose-300';
    return 'text-slate-400';
  };

  return (
    <div className="menu-shell">
      <div className="flex flex-col items-center justify-center">
        <h1 className="ritual-title ritual-title-gradient text-5xl sm:text-6xl mb-6">
          COLOR-JELLY-RUSH
        </h1>
        <div className="ritual-kicker text-xs sm:text-sm mb-6">
          LEVEL {level} · UNLOCKED {unlockedLevel}
          <span className={`ritual-pill ml-3 ${statusColor()}`}>Net {statusLabel()}</span>
        </div>

        <div className="ritual-panel w-[22rem] sm:w-[26rem]">
          <div className="mb-6">
            <label className="block text-xs uppercase tracking-[0.3em] text-[color:var(--mist-400)] mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => onNameChange(e.target.value)}
              className="ritual-input"
              placeholder="Enter name..."
            />
          </div>

          <div className="mb-8">
            <label className="block text-xs uppercase tracking-[0.3em] text-[color:var(--mist-400)] mb-2">
              Shape Sigil
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['circle', 'square', 'triangle', 'hex'] as ShapeId[]).map(s => (
                <button
                  key={s}
                  onClick={() => onShapeChange(s)}
                  className={`p-3 uppercase tracking-[0.25em] text-xs ${shape === s ? 'ritual-chip ritual-chip-active' : 'ritual-chip'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--mist-400)]">
              Renderer
            </div>
            <button
              onClick={() => onTogglePixi(!usePixi)}
              className={`px-3 py-2 rounded border text-[0.65rem] font-bold tracking-[0.3em] uppercase ${usePixi ? 'border-[color:rgba(209,176,106,0.6)] text-[color:var(--bone-100)]' : 'border-[color:rgba(225,214,200,0.2)] text-[color:var(--mist-400)]'}`}
            >
              {usePixi ? 'Pixi' : 'Canvas'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleStart}
              disabled={!name.trim()}
              className={`ritual-button ${name.trim() ? 'ritual-button-primary' : 'ritual-button-muted opacity-60 cursor-not-allowed'}`}
            >
              Play Solo
            </button>
            <button
              onClick={onOpenMatchmaking}
              disabled={!name.trim()}
              className={`ritual-button ${name.trim() ? 'ritual-button-emerald' : 'ritual-button-muted opacity-60 cursor-not-allowed'}`}
            >
              Queue
            </button>
          </div>
          <div className="mt-3 text-xs text-[color:var(--mist-400)]">
            {useMultiplayer
              ? 'Online runs authoritative simulation.'
              : 'Queue to summon a live match.'}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-[0.65rem] uppercase tracking-[0.25em]">
            <button onClick={onOpenLevels} className="ritual-button ritual-button-ghost py-2">
              Levels
            </button>
            <button onClick={onOpenTutorial} className="ritual-button ritual-button-ghost py-2">
              Lore
            </button>
            <button onClick={onOpenSettings} className="ritual-button ritual-button-ghost py-2">
              Set
            </button>
            <button onClick={onOpenMatchmaking} className="ritual-button ritual-button-ghost py-2">
              Queue
            </button>
            <button onClick={onOpenTournament} className="ritual-button ritual-button-ghost py-2">
              Tourney
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
