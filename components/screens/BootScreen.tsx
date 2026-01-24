import React from 'react';

const BootScreen: React.FC = () => {
  return (
    <div className="menu-shell">
      <div className="flex flex-col items-center justify-center">
        <div className="ritual-title ritual-title-gradient text-4xl sm:text-5xl">
        COLOR JELLY RUSH
        </div>
        <div className="mt-6 text-[color:var(--mist-400)] tracking-[0.3em] uppercase text-xs">Mixing pigments…</div>
        <div className="mt-4 w-64 h-2 rounded bg-[color:var(--ink-900)] overflow-hidden">
          <div className="h-full w-1/2 bg-[linear-gradient(120deg,#d1b06a,#c16c35)] animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default BootScreen;
