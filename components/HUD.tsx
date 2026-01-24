
import React, { useEffect, useState } from 'react';
import { GameState, RingId } from '../types';
import { getColorHint } from '../services/cjr/colorMath';

interface HUDProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  isTouchInput: boolean;
}

const HUD: React.FC<HUDProps> = ({ gameStateRef }) => {
  const [matchPercent, setMatchPercent] = useState(0);
  const [currentRing, setCurrentRing] = useState<RingId>(1);
  const [nextReq, setNextReq] = useState(0);
  const [score, setScore] = useState(0);
  const [winTimer, setWinTimer] = useState(0);
  const [winHoldSeconds, setWinHoldSeconds] = useState(1.5);
  const [colorHint, setColorHint] = useState('');
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [goalLabel, setGoalLabel] = useState('Goal: Ring 2');
  const [rushTimer, setRushTimer] = useState(0);
  const [rushRing, setRushRing] = useState(0);

  useEffect(() => {
    const link = setInterval(() => {
      const state = gameStateRef.current;
      if (!state || !state.player) return;

      setMatchPercent(state.player.matchPercent);
      setCurrentRing(state.player.ring);
      setScore(Math.floor(state.player.score));

      // Calculate Next Requirement
      let req = 0;
      let goalText = '';
      if (state.player.ring === 1) req = state.levelConfig.thresholds.ring2;
      else if (state.player.ring === 2) req = state.levelConfig.thresholds.ring3;
      else req = state.levelConfig.thresholds.win;
      if (state.player.ring === 1) goalText = 'Goal: Ring 2';
      else if (state.player.ring === 2) goalText = 'Goal: Ring 3';
      else goalText = 'Goal: Core';
      setNextReq(req);
      setGoalLabel(goalText);

      setWinTimer(state.player.stationaryTime || 0);
      setWinHoldSeconds(state.levelConfig?.winHoldSeconds || 1.5);
      setLevel(state.level || 1);
      const limit = state.levelConfig?.timeLimit || 0;
      setTimeLeft(Math.max(0, Math.ceil(limit - state.gameTime)));
      const rushTime = state.runtime?.boss?.rushWindowTimer || 0;
      setRushTimer(rushTime);
      setRushRing(state.runtime?.boss?.rushWindowRing || 0);

      // Color hint
      const hint = getColorHint(state.player.pigment, state.player.targetPigment);
      setColorHint(hint);
    }, 100);
    return () => clearInterval(link);
  }, []); // Ref dependency omitted on purpose for interval loop

  // Visuals
  const percent = Math.floor(matchPercent * 100);
  const reqPercent = Math.floor(nextReq * 100);

  // Circular progress calculation
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (matchPercent * circumference);

  return (
    <div className="absolute inset-0 pointer-events-none font-ui">
      {/* Top Center: Circular Match Progress */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
        {/* SVG Circular Progress */}
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="#333"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="url(#matchGradient)"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
            {/* Threshold notch */}
            <circle
              cx={64 + radius * Math.cos((nextReq * 2 * Math.PI) - Math.PI / 2)}
              cy={64 + radius * Math.sin((nextReq * 2 * Math.PI) - Math.PI / 2)}
              r="4"
              fill="#fff"
            />
            <defs>
              <linearGradient id="matchGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff3333" />
                <stop offset="50%" stopColor="#ffff33" />
                <stop offset="100%" stopColor="#33ff33" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[color:var(--bone-100)] font-display text-2xl">{percent}%</div>
            <div className="text-[color:var(--mist-400)] text-xs uppercase tracking-[0.2em]">Ring {currentRing}</div>
          </div>
        </div>

        {/* Color Hint */}
        <div className="mt-2 text-[color:var(--gold-400)] font-semibold text-sm drop-shadow-md">
          {colorHint}
        </div>

        {/* Target */}
        <div className="text-[color:var(--bone-200)] text-xs opacity-80 mt-1 uppercase tracking-[0.15em]">
          {goalLabel} ≥ {reqPercent}%
        </div>
      </div>

      {/* Score */}
      <div className="absolute top-4 left-4 text-[color:var(--bone-100)] font-display text-2xl drop-shadow-md">
        SCORE: {score}
      </div>
      <div className="absolute top-4 right-4 text-[color:var(--bone-100)] font-display text-lg drop-shadow-md text-right">
        <div>LEVEL {level}</div>
        <div className="text-xs text-[color:var(--mist-400)]">TIME {timeLeft}s</div>
        {rushTimer > 0 && (
          <div className="text-xs text-[color:var(--gold-400)] mt-1">
            RUSH R{rushRing} · {Math.ceil(rushTimer)}s
          </div>
        )}
      </div>

      {/* Win Channeling Alert */}
      {winTimer > 0 && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 flex flex-col items-center animate-pulse">
          <div className="text-[color:var(--gold-400)] font-display text-3xl sm:text-4xl">
            SECURING VICTORY
          </div>
          <div className="w-40 h-4 bg-[color:var(--ink-900)] mt-2 rounded">
            <div className="h-full bg-[color:var(--gold-400)]" style={{ width: `${Math.min(100, (winTimer / Math.max(0.1, winHoldSeconds)) * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default HUD;
