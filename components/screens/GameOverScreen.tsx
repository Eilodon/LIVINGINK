import React from 'react';

type Props = {
  level: number;
  result: 'win' | 'lose';
  onRetry: () => void;
  onNext: () => void;
  onLevels: () => void;
  canNext: boolean;
};

const GameOverScreen: React.FC<Props> = ({ level, result, onRetry, onNext, onLevels, canNext }) => {
  const isWin = result === 'win';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
      <div className={`text-6xl font-black mb-4 drop-shadow-lg ${isWin ? 'text-yellow-300' : 'text-red-400'}`}>
        {isWin ? 'VICTORY!' : 'DEFEAT'}
      </div>
      <div className="text-slate-300 mb-8">{isWin ? `Level ${level} cleared.` : `Level ${level} failed.`}</div>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="px-8 py-4 rounded-lg font-bold text-lg bg-gradient-to-r from-pink-500 to-violet-600 hover:scale-105 transition"
        >
          RETRY
        </button>
        <button
          onClick={onLevels}
          className="px-8 py-4 rounded-lg font-bold text-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 transition"
        >
          LEVELS
        </button>
      </div>
      {isWin && canNext && (
        <button
          onClick={onNext}
          className="mt-4 px-8 py-3 rounded-lg font-bold text-sm bg-slate-900 border border-slate-600 hover:bg-slate-800 transition"
        >
          NEXT LEVEL
        </button>
      )}
    </div>
  );
};

export default GameOverScreen;

