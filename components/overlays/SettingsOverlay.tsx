import React from 'react';

type Props = {
  usePixi: boolean;
  useMultiplayer: boolean;
  onTogglePixi: (next: boolean) => void;
  onToggleMultiplayer: (next: boolean) => void;
  onClose: () => void;
};

const SettingsOverlay: React.FC<Props> = ({
  usePixi,
  useMultiplayer,
  onTogglePixi,
  onToggleMultiplayer,
  onClose
}) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm text-white">
      <div className="ritual-panel w-full max-w-md">
        <div className="flex items-center justify-between">
          <div className="ritual-title text-xl">Settings</div>
          <button onClick={onClose} className="ritual-button ritual-button-ghost text-[0.65rem] px-3 py-1">X</button>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <div className="font-bold">Graphics</div>
            <div className="text-xs text-[color:var(--mist-400)]">Pixi = smoother VFX, Canvas = battery saver</div>
          </div>
          <button
            onClick={() => onTogglePixi(!usePixi)}
            className={`px-3 py-2 rounded border text-xs font-bold tracking-widest uppercase ${usePixi ? 'border-[color:rgba(209,176,106,0.6)] text-[color:var(--bone-100)]' : 'border-[color:rgba(225,214,200,0.2)] text-[color:var(--mist-400)]'}`}
          >
            {usePixi ? 'PIXI' : 'CANVAS'}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <div className="font-bold">Network</div>
            <div className="text-xs text-[color:var(--mist-400)]">Authoritative server + interpolation</div>
          </div>
          <button
            onClick={() => onToggleMultiplayer(!useMultiplayer)}
            className={`px-3 py-2 rounded border text-xs font-bold tracking-widest uppercase ${useMultiplayer ? 'border-[color:rgba(47,141,110,0.6)] text-emerald-200' : 'border-[color:rgba(225,214,200,0.2)] text-[color:var(--mist-400)]'}`}
          >
            {useMultiplayer ? 'ONLINE' : 'OFFLINE'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsOverlay;
