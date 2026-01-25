
import React, { useEffect, useState, useRef } from 'react';
import { GameState, RingId } from '../types';
import { getColorHint } from '../services/cjr/colorMath';
import { RING_THRESHOLDS } from '../services/cjr/cjrConstants';

interface HUDProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  isTouchInput: boolean;
}

const HUD: React.FC<HUDProps> = ({ gameStateRef }) => {
  const [matchPercent, setMatchPercent] = useState(0);
  const [currentRing, setCurrentRing] = useState<RingId>(1);
  const [score, setScore] = useState(0);
  const [winTimer, setWinTimer] = useState(0);
  const [colorHint, setColorHint] = useState('');
  const [waveTimer, setWaveTimer] = useState(0);
  const [minimapData, setMinimapData] = useState<{ x: number, y: number, r: number } | null>(null);

  useEffect(() => {
    const link = setInterval(() => {
      const state = gameStateRef.current;
      if (!state || !state.player) return;

      setMatchPercent(state.player.matchPercent);
      setCurrentRing(state.player.ring);
      setScore(Math.floor(state.player.score));
      setWinTimer(state.player.stationaryTime || 0);

      const hint = getColorHint(state.player.pigment, state.player.targetPigment);
      setColorHint(hint);

      // Wave Timer (approximate from gameTime % interval)
      const now = state.gameTime * 1000;
      setWaveTimer(10000 - (now % 10000)); // Demo loop

      // Minimap Player Pos (Normalized to R1)
      const r1 = 1600; // Map Radius
      setMinimapData({
        x: state.player.position.x / r1,
        y: state.player.position.y / r1,
        r: state.player.ring
      });

    }, 60); // 16ms too fast for React state, 60ms is smooth enough
    return () => clearInterval(link);
  }, []);

  // Visuals
  const percent = Math.floor(matchPercent * 100);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (matchPercent * circumference);

  const isWinHold = matchPercent >= RING_THRESHOLDS.WIN_HOLD && currentRing === 3;
  const pulseClass = isWinHold ? 'animate-pulse scale-110 text-yellow-400' : '';

  // Calculate Notch Angles (0 start is -90deg usually in these SVGs)
  // But our SVG below is rotated -90deg, so 0 is top.
  // 360 * val
  const notch50 = 360 * 0.50;
  const notch70 = 360 * 0.70;
  const notch90 = 360 * 0.90;

  const getPosOnCircle = (deg: number) => {
    const rad = (deg - 90) * (Math.PI / 180); // -90 to start top
    return {
      x: 64 + radius * Math.cos(rad),
      y: 64 + radius * Math.sin(rad)
    };
  };

  const p50 = getPosOnCircle(notch50);
  const p70 = getPosOnCircle(notch70);
  const p90 = getPosOnCircle(notch90);

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-ui overflow-hidden">

      {/* --- TOP CENTER: MATCH METER --- */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className={`relative w-36 h-36 transition-transform duration-500 ${isWinHold ? 'scale-110' : ''}`}>
          <svg className="w-full h-full drop-shadow-xl">
            {/* Background Track */}
            <circle cx="72" cy="72" r={radius} stroke="rgba(0,0,0,0.6)" strokeWidth="10" fill="rgba(0,0,0,0.2)" />

            {/* Notches (Background) */}
            <line x1="72" y1="72" x2={p50.x + 8} y2={p50.y + 8} stroke="rgba(255,255,255,0.2)" strokeWidth="2" />

            {/* Progress */}
            <circle
              cx="72" cy="72" r={radius}
              stroke="url(#matchGrad)"
              strokeWidth="10"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              strokeLinecap="round"
              transform="rotate(-90 72 72)"
              className="transition-all duration-300"
            />

            {/* Notch Indicators (Overlay) */}
            {/* 50% Notch */}
            <circle cx={getPosOnCircle(notch50 + 90).x + 8} cy={getPosOnCircle(notch50 + 90).y + 8} r="3" fill={percent >= 50 ? "#fff" : "#444"} />
            {/* 70% Notch */}
            <circle cx={getPosOnCircle(notch70 + 90).x + 8} cy={getPosOnCircle(notch70 + 90).y + 8} r="3" fill={percent >= 70 ? "#fff" : "#444"} />
            {/* 90% Notch */}
            <circle cx={getPosOnCircle(notch90 + 90).x + 8} cy={getPosOnCircle(notch90 + 90).y + 8} r="4" fill={percent >= 90 ? "#fbbf24" : "#444"} stroke="#000" strokeWidth="1" />

            <defs>
              <linearGradient id="matchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="60%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
          </svg>

          {/* Central Percent */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black font-display drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${pulseClass} text-white`}>
              {percent}%
            </span>
            <span className="text-[10px] uppercase tracking-widest text-white/50">Match</span>
          </div>
        </div>

        {/* Dynamic Hint */}
        <div className="mt-2 text-center">
          <div className={`text-sm font-bold tracking-wide drop-shadow-md px-4 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 ${colorHint ? 'text-white' : 'text-transparent'}`}>
            {colorHint || "..."}
          </div>
        </div>
      </div>

      {/* --- TOP RIGHT: INFO --- */}
      <div className="absolute top-6 right-6 text-right">
        <div className="flex flex-col gap-1 items-end">
          <div className="text-white font-display text-xl drop-shadow-lg">SCORE <span className="text-yellow-400">{score.toLocaleString()}</span></div>
          <div className="text-white/60 text-xs font-mono uppercase">Wave In {(waveTimer / 1000).toFixed(1)}s</div>

          {/* Ring Status Badge */}
          <div className={`mt-2 px-3 py-1 rounded border overflow-hidden relative ${currentRing === 3 ? 'bg-red-900/80 border-red-500' :
              currentRing === 2 ? 'bg-blue-900/80 border-blue-500' :
                'bg-slate-800/80 border-slate-500'
            }`}>
            <span className="relative z-10 text-xs font-bold text-white uppercase tracking-wider">
              {currentRing === 3 ? 'DEATH ZONE' : currentRing === 2 ? 'THE ARENA' : 'OUTER RIM'}
            </span>
          </div>
        </div>
      </div>

      {/* --- BOTTOM LEFT: MINIMAP --- */}
      <div className="absolute bottom-6 left-6 w-32 h-32 bg-black/50 rounded-full border-2 border-white/10 backdrop-blur-sm overflow-hidden flex items-center justify-center pointer-events-auto">
        {/* Rings */}
        <div className="absolute w-[100%] h-[100%] rounded-full border border-white/10 box-border" />
        <div className="absolute w-[62%] h-[62%] rounded-full border border-blue-500/30 box-border" /> {/* R2 */}
        <div className="absolute w-[31%] h-[31%] rounded-full border border-red-500/30 box-border bg-red-900/10" /> {/* R3 */}
        <div className="absolute w-[9%] h-[9%] rounded-full bg-yellow-500/20 box-border" /> {/* Center */}

        {/* Player Dot */}
        {minimapData && (
          <div
            className="absolute w-2 h-2 bg-white rounded-full shadow-[0_0_4px_white]"
            style={{
              transform: `translate(${minimapData.x * 64}px, ${minimapData.y * 64}px)`
            }}
          />
        )}
      </div>

      {/* --- CENTER: WIN HOLD OVERLAY --- */}
      {isWinHold && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 flex flex-col items-center animate-pulse">
          <div className="text-yellow-400 font-display text-4xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
            CHANNELING
          </div>
          <div className="w-64 h-3 bg-black/50 rounded mt-2 overflow-hidden border border-yellow-500/50">
            <div
              className="h-full bg-yellow-400 shadow-[0_0_10px_#fbbf24]"
              style={{ width: `${Math.min(100, (winTimer / 1.5) * 100)}%` }}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default HUD;

