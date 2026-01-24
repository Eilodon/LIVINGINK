import React from 'react';

type Props = {
  usePixi: boolean;
  onTogglePixi: (next: boolean) => void;
  onClose: () => void;
};

const SettingsOverlay: React.FC<Props> = ({ usePixi, onTogglePixi, onClose }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm text-white">
      <div className="w-full max-w-md rounded-2xl bg-slate-950/80 border border-slate-700 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-black tracking-widest">SETTINGS</div>
          <button onClick={onClose} className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 transition">X</button>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <div className="font-bold">Graphics</div>
            <div className="text-xs text-slate-400">Pixi = smoother VFX, Canvas = battery saver</div>
          </div>
          <button
            onClick={() => onTogglePixi(!usePixi)}
            className={`px-3 py-2 rounded border text-xs font-bold tracking-widest ${usePixi ? 'bg-violet-600/30 border-violet-400/50 text-violet-200' : 'bg-slate-800 border-slate-600 text-slate-200'}`}
          >
            {usePixi ? 'PIXI' : 'CANVAS'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsOverlay;

