import React from 'react';

type Props = {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onSettings: () => void;
};

const PauseOverlay: React.FC<Props> = ({ onResume, onRestart, onQuit, onSettings }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm text-white">
      <div className="w-full max-w-md rounded-2xl bg-slate-950/80 border border-slate-700 p-6 shadow-2xl">
        <div className="text-3xl font-black tracking-widest">PAUSED</div>
        <div className="mt-1 text-slate-400 text-sm">Take a breath. Decide your next move.</div>

        <div className="mt-6 grid grid-cols-1 gap-2">
          <button onClick={onResume} className="py-3 rounded-lg bg-violet-600 hover:bg-violet-500 font-bold transition">RESUME</button>
          <button onClick={onRestart} className="py-3 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold transition">RESTART</button>
          <button onClick={onSettings} className="py-3 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold transition">SETTINGS</button>
          <button onClick={onQuit} className="py-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 font-bold transition">QUIT</button>
        </div>

        <div className="mt-5 text-xs text-slate-500 leading-relaxed">
          Tip: if you’re stuck below a threshold too long, you’ll get a short color-boost. Use solvent/catalyst waves to correct quickly.
        </div>
      </div>
    </div>
  );
};

export default PauseOverlay;

