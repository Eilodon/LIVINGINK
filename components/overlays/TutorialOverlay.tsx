import React, { useMemo } from 'react';

type Props = {
  step: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: (didFinish: boolean) => void;
};

type Step = {
  title: string;
  body: string;
  tip?: string;
};

const STEPS: Step[] = [
  {
    title: 'Move',
    body: 'Drag your aim (or joystick) to glide. Bigger jelly = slower, so keep your momentum early.',
    tip: 'If you stop moving, you become an easy target.',
  },
  {
    title: 'Eat → Grow',
    body: 'Eat pigments to gain mass. Bigger size helps you win fights but makes you slower.',
    tip: 'Neutral food grows you without messing your color.',
  },
  {
    title: 'Match %',
    body: 'Your goal is to match the needed color. Watch the % and the hint (“Need GREEN”, “Too RED”…).',
    tip: 'From ~80% match, correct pigments pull harder (snap assist).',
  },
  {
    title: 'Membranes',
    body: 'Cross the color membrane to enter the next ring when you meet the threshold. Once you enter, you can’t go back.',
    tip: 'Ring 1 is safe and rich. Inner rings are poor and dangerous.',
  },
  {
    title: 'Boss Events',
    body: 'Boss fights are shared events. Defeat Boss I to open Ring 2; Boss II to open Ring 3 + a dramatic finish.',
    tip: 'Last hit gives a short headstart, but only if you contributed.',
  },
  {
    title: 'Win',
    body: 'Touch the Core and hold ≥ 90% match for 1.5s. Getting hit resets the hold — so time it carefully.',
    tip: 'Commit early for distance advantage, or farm longer for safety. That decision is the game.',
  },
];

const TutorialOverlay: React.FC<Props> = ({ step, onNext, onPrev, onClose }) => {
  const idx = Math.max(0, Math.min(STEPS.length - 1, step));
  const data = useMemo(() => STEPS[idx], [idx]);
  const isLast = idx === STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm text-white">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-950/80 border border-slate-700 p-6 shadow-2xl mx-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-slate-400 tracking-widest">
              TUTORIAL {idx + 1}/{STEPS.length}
            </div>
            <div className="text-3xl font-black tracking-wide mt-1">{data.title}</div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
          >
            SKIP
          </button>
        </div>

        <div className="mt-5 text-slate-200 leading-relaxed">{data.body}</div>
        {data.tip && <div className="mt-3 text-sm text-yellow-200/90">Tip: {data.tip}</div>}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={onPrev}
            disabled={idx === 0}
            className={[
              'px-4 py-2 rounded-lg border font-bold transition',
              idx === 0 ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-900 border-slate-700 hover:bg-slate-800',
            ].join(' ')}
          >
            BACK
          </button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                onClick={onNext}
                className="px-5 py-2 rounded-lg font-bold bg-violet-600 hover:bg-violet-500 transition"
              >
                NEXT
              </button>
            )}
            {isLast && (
              <button
                onClick={() => onClose(true)}
                className="px-5 py-2 rounded-lg font-bold bg-gradient-to-r from-pink-500 to-violet-600 hover:scale-[1.02] transition"
              >
                LET’S PLAY
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;

