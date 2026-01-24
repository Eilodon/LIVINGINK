import React, { useMemo } from 'react';
import { LEVELS } from '../../services/cjr/levels';

type Props = {
  currentLevel: number;
  unlockedLevel: number;
  onBack: () => void;
  onPlay: (level: number) => void;
};

const LevelSelectScreen: React.FC<Props> = ({ currentLevel, unlockedLevel, onBack, onPlay }) => {
  const levels = useMemo(() => LEVELS.slice(0, 20), []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="px-6 py-5 flex items-center justify-between border-b border-slate-800">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 transition"
        >
          BACK
        </button>
        <div className="text-lg font-black tracking-widest">LEVEL SELECT</div>
        <div className="text-sm text-slate-400">Unlocked: {unlockedLevel}</div>
      </div>

      <div className="p-6 max-w-6xl w-full mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {levels.map((l) => {
            const locked = l.id > unlockedLevel;
            const isCurrent = l.id === currentLevel;
            return (
              <button
                key={l.id}
                disabled={locked}
                onClick={() => onPlay(l.id)}
                className={[
                  'p-4 rounded-xl border text-left transition',
                  locked ? 'bg-slate-900/40 border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-900 border-slate-700 hover:border-pink-500 hover:shadow-glow',
                  isCurrent ? 'ring-2 ring-violet-500' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between">
                  <div className="text-2xl font-black">{l.id}</div>
                  {locked && <div className="text-xs font-mono">LOCKED</div>}
                </div>
                <div className="mt-1 font-semibold">{l.name}</div>
                <div className="mt-2 text-xs text-slate-400">
                  Bots: {l.botCount} · Time: {Math.round(l.timeLimit)}s
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Boss: {l.boss.boss1Enabled ? 'I' : '-'} / {l.boss.boss2Enabled ? 'II' : '-'}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 text-sm text-slate-400 leading-relaxed">
          Tip: Levels 1–3 are gentle tutorials. Level 4 introduces the first boss event. From level 7 onward,
          the pace tightens and bosses arrive earlier.
        </div>
      </div>
    </div>
  );
};

export default LevelSelectScreen;

