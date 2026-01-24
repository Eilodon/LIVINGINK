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
    title: 'Tattoos',
    body: 'As you grow, you unlock tattoo choices. Pick one to shape your build and spike your power.',
    tip: 'Some tattoos combo into synergies — experiment.',
  },
  {
    title: 'Membranes',
    body: 'Cross the color membrane to enter the next ring when you meet the threshold. Once you enter, you can’t go back.',
    tip: 'Ring 1 is safe and rich. Inner rings are poor and dangerous.',
  },
  {
    title: 'Boss Events',
    body: 'The Ring Guardian spawns in Ring 2. Defeat it to trigger a Rush Window with extra special pickups.',
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
      <div className="ritual-panel w-full max-w-2xl mx-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="ritual-kicker text-xs">
              TUTORIAL {idx + 1}/{STEPS.length}
            </div>
            <div className="ritual-title text-2xl mt-1">{data.title}</div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="ritual-button ritual-button-ghost text-[0.65rem] px-3 py-1"
          >
            SKIP
          </button>
        </div>

        <div className="mt-5 text-[color:var(--bone-200)] leading-relaxed">{data.body}</div>
        {data.tip && <div className="mt-3 text-sm text-[color:var(--gold-400)]">Tip: {data.tip}</div>}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={onPrev}
            disabled={idx === 0}
            className={[
              'ritual-button text-xs px-4 py-2',
              idx === 0 ? 'ritual-button-muted cursor-not-allowed' : 'ritual-button-ghost',
            ].join(' ')}
          >
            BACK
          </button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                onClick={onNext}
                className="ritual-button ritual-button-primary text-xs px-5 py-2"
              >
                NEXT
              </button>
            )}
            {isLast && (
              <button
                onClick={() => onClose(true)}
                className="ritual-button ritual-button-emerald text-xs px-5 py-2"
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
