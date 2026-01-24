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
      <div className="ritual-panel w-full max-w-md">
        <div className="ritual-title text-2xl">Paused</div>
        <div className="mt-1 text-[color:var(--mist-400)] text-sm">Take a breath. Decide your next move.</div>

        <div className="mt-6 grid grid-cols-1 gap-2">
          <button onClick={onResume} className="ritual-button ritual-button-primary text-sm">RESUME</button>
          <button onClick={onRestart} className="ritual-button ritual-button-ghost text-sm">RESTART</button>
          <button onClick={onSettings} className="ritual-button ritual-button-ghost text-sm">SETTINGS</button>
          <button onClick={onQuit} className="ritual-button ritual-button-muted text-sm">QUIT</button>
        </div>

        <div className="mt-5 text-xs text-[color:var(--mist-400)] leading-relaxed">
          Tip: if you’re stuck below a threshold too long, you’ll get a short color-boost. Use solvent/catalyst waves to correct quickly.
        </div>
      </div>
    </div>
  );
};

export default PauseOverlay;
