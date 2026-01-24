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
      <div className="ritual-panel text-center">
        <div className={`ritual-title text-4xl sm:text-5xl mb-3 ${isWin ? 'text-[color:var(--gold-400)]' : 'text-[color:var(--blood-500)]'}`}>
          {isWin ? 'Victory' : 'Defeat'}
        </div>
        <div className="text-[color:var(--mist-400)] mb-8">
          {isWin ? `Level ${level} cleared.` : `Level ${level} failed.`}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={onRetry}
          className="ritual-button ritual-button-primary text-sm"
        >
          RETRY
        </button>
        <button
          onClick={onLevels}
          className="ritual-button ritual-button-ghost text-sm"
        >
          LEVELS
        </button>
        </div>
        {isWin && canNext && (
          <button
            onClick={onNext}
            className="mt-4 ritual-button ritual-button-emerald text-xs"
          >
            NEXT LEVEL
          </button>
        )}
      </div>
    </div>
  );
};

export default GameOverScreen;
