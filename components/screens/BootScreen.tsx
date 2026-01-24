import React from 'react';

const BootScreen: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white">
      <div className="text-5xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">
        COLOR JELLY RUSH
      </div>
      <div className="mt-6 text-slate-400 font-mono">Mixing pigments…</div>
      <div className="mt-4 w-64 h-2 rounded bg-slate-800 overflow-hidden">
        <div className="h-full w-1/2 bg-gradient-to-r from-pink-500 to-violet-600 animate-pulse" />
      </div>
    </div>
  );
};

export default BootScreen;

