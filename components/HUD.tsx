import React, { useEffect, useRef, memo } from 'react';
import { GameState } from '../types';
import { getColorHint } from '../services/cjr/colorMath';
import { THRESHOLDS } from '../constants';
import { useGameDataBridge } from '../hooks/useGameDataBridge';

interface HUDProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  isTouchInput: boolean;
}

const HUD: React.FC<HUDProps> = memo(({ gameStateRef }) => {
  // EIDOLON ARCHITECT: Zero-Render HUD - All updates via direct DOM manipulation
  const scoreRef = useRef<HTMLSpanElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const percentCircleRef = useRef<SVGCircleElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);

  // CRITICAL: Direct DOM manipulation refs (no useState = no re-renders)
  const colorHintRef = useRef<HTMLDivElement>(null);
  const winHoldContainerRef = useRef<HTMLDivElement>(null);
  const ringBadgeRef = useRef<HTMLSpanElement>(null); // For currentRing display if needed

  // EIDOLON-V FIX: The Blind HUD Fix
  const { getStats } = useGameDataBridge(gameStateRef);

  // Cache to avoid DOM thrashing
  // EIDOLON-V: displayScore for smooth lerp animation
  const cache = useRef({ score: -1, displayScore: 0, percent: -1, waveTime: -1, ring: -1, colorHint: '', isWinHold: false });

  useEffect(() => {
    let rafId: number;
    const radius = 60;
    const circumference = 2 * Math.PI * radius;

    const loop = () => {
      const state = gameStateRef.current;
      if (!state || !state.player) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      // EIDOLON-V: Read from Bridge (Fast Path)
      const stats = getStats();
      const p = state.player; // Still needed for slow updates (pigment, ring) until we bridge those too

      // 1. Score (EIDOLON-V: Smooth Lerp Animation)
      const targetScore = Math.floor(stats.score);
      // Lerp factor 0.1 = smooth interpolation over ~10 frames
      cache.current.displayScore += (targetScore - cache.current.displayScore) * 0.1;

      // Only update DOM if rounded value changed (avoids sub-pixel thrashing)
      const displayInt = Math.round(cache.current.displayScore);
      if (displayInt !== cache.current.score) {
        cache.current.score = displayInt;
        if (scoreRef.current) {
          scoreRef.current.textContent = displayInt.toLocaleString();
        }
      }

      // 2. Match %
      const pct = Math.floor(stats.matchPercent * 100);
      if (pct !== cache.current.percent) {
        cache.current.percent = pct;
        if (percentRef.current) percentRef.current.textContent = `${pct}%`;
        if (percentCircleRef.current) {
          const offset = circumference - (stats.matchPercent * circumference);
          percentCircleRef.current.style.strokeDashoffset = `${offset}`;
          const color = pct >= 90 ? '#fbbf24' : (pct >= 50 ? '#3b82f6' : '#ef4444');
          percentCircleRef.current.style.stroke = color;
        }
      }

      // 3. Wave Timer
      if (waveRef.current) {
        const now = state.gameTime;
        const timer = 10 - (now % 10);
        // Only update if integer second changed (or 0.1s granularity if needed, lets do 0.5s check or integer)
        // User requested integer check or similar optimization.
        // Let's optimize to 1 decimal place but check if string would be diff.
        // Actually best perf is integer updates or throttle. 
        // Request said: "Check if integer value changed"

        const displayVal = Math.floor(timer * 10); // Check 0.1s diff
        if (displayVal !== cache.current.waveTime) {
          cache.current.waveTime = displayVal;
          waveRef.current.textContent = `WAVE IN ${(displayVal / 10).toFixed(1)}s`;
        }
      }

      // 4. Color Hint (EIDOLON ARCHITECT: Direct DOM manipulation - no setState)
      const hint = getColorHint(p.pigment, p.targetPigment);
      if (hint !== cache.current.colorHint && colorHintRef.current) {
        cache.current.colorHint = hint;
        colorHintRef.current.textContent = hint || '...';
        // Toggle visibility class
        if (hint) {
          colorHintRef.current.style.opacity = '1';
        } else {
          colorHintRef.current.style.opacity = '0';
        }
      }

      // 5. Win Hold Animation (EIDOLON ARCHITECT: Direct classList manipulation)
      const hold = p.matchPercent >= THRESHOLDS.WIN_HOLD && p.ring === 3;
      if (hold !== cache.current.isWinHold && winHoldContainerRef.current) {
        cache.current.isWinHold = hold;
        // CRITICAL: Direct classList toggle (no React re-render)
        winHoldContainerRef.current.classList.toggle('scale-110', hold);
      }

      // 6. Current Ring (optional - update badge if displayed)
      if (p.ring !== cache.current.ring) {
        cache.current.ring = p.ring;
        // If you have a ring badge element, update it here:
        // if (ringBadgeRef.current) ringBadgeRef.current.textContent = `R${p.ring}`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // EIDOLON ARCHITECT: Empty deps - no re-renders, component mounts once

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-ui overflow-hidden">
      {/* Match Meter */}
      <div ref={winHoldContainerRef} className={`absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center transition-transform duration-300`}>
        <div className="relative w-36 h-36">
          <svg className="w-full h-full drop-shadow-xl rotate-[-90deg]">
            <circle cx="72" cy="72" r="60" stroke="rgba(0,0,0,0.6)" strokeWidth="10" fill="rgba(0,0,0,0.2)" />
            <circle
              ref={percentCircleRef}
              cx="72" cy="72" r="60"
              stroke="#ef4444"
              strokeWidth="10"
              fill="none"
              strokeDasharray={377}
              strokeDashoffset={377}
              strokeLinecap="round"
              className="transition-all duration-100 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span ref={percentRef} className="text-3xl font-black font-display text-white">0%</span>
            <span className="text-[10px] uppercase tracking-widest text-white/50">MATCH</span>
          </div>
        </div>
        <div ref={colorHintRef} className={`mt-2 text-sm font-bold px-4 py-1 rounded-full bg-black/40 border border-white/10 text-white transition-opacity opacity-0`}>
          ...
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-6 right-6 text-right">
        <div className="text-white font-display text-xl drop-shadow-lg">
          SCORE <span ref={scoreRef} className="text-yellow-400">0</span>
        </div>
        <div ref={waveRef} className="text-white/60 text-xs font-mono uppercase">WAVE READY</div>
      </div>
    </div>
  );
});

export default HUD;
