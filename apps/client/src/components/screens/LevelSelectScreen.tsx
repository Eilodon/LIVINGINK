import React, { useMemo } from 'react';
import { LEVELS } from '@/game/cjr/levels';

type Props = {
  currentLevel: number;
  unlockedLevel: number;
  onBack: () => void;
  onPlay: (level: number) => void;
};

const LevelSelectScreen: React.FC<Props> = ({ currentLevel, unlockedLevel, onBack, onPlay }) => {
  const levels = useMemo(() => LEVELS.slice(0, 20), []);

  return (
    <div className="min-h-screen text-[color:var(--bone-100)] flex flex-col">
      <div className="px-6 py-5 flex items-center justify-between border-b border-[color:rgba(225,214,200,0.12)]">
        <button
          onClick={onBack}
          className="ritual-button ritual-button-ghost px-4 py-2 text-[0.65rem]"
        >
          BACK
        </button>
        <div className="ritual-title text-lg">Level Select</div>
        <div className="text-sm text-[color:var(--mist-400)]">Unlocked: {unlockedLevel}</div>
      </div>

      <div className="p-6 max-w-6xl w-full mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {levels.map(l => {
            const locked = l.id > unlockedLevel;
            const isCurrent = l.id === currentLevel;
            return (
              <button
                key={l.id}
                disabled={locked}
                onClick={() => onPlay(l.id)}
                className={[
                  'text-left',
                  locked ? 'ritual-card ritual-card-locked cursor-not-allowed' : 'ritual-card',
                  isCurrent ? 'ring-2 ring-[color:rgba(209,176,106,0.6)]' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between">
                  <div className="text-2xl font-black">{l.id}</div>
                  {locked && (
                    <div className="text-xs tracking-[0.2em] uppercase text-[color:var(--mist-400)]">
                      Locked
                    </div>
                  )}
                </div>
                <div className="mt-1 font-semibold">{l.name}</div>
                <div className="mt-2 text-xs text-[color:var(--mist-400)]">
                  Bots: {l.botCount} · Time: {Math.round(l.timeLimit)}s
                </div>
                <div className="mt-1 text-xs text-[color:var(--mist-400)]">
                  Boss: {l.boss.boss1Enabled ? 'I' : '-'} / {l.boss.boss2Enabled ? 'II' : '-'}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 text-sm text-[color:var(--mist-400)] leading-relaxed">
          Tip: Levels 1–3 are gentle tutorials. Level 4 introduces the first boss event. From level
          7 onward, the pace tightens and bosses arrive earlier.
        </div>
      </div>
    </div>
  );
};

export default LevelSelectScreen;
