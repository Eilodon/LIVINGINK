
import React, { useEffect, useState } from 'react';
import { GameState, RingId } from '../types';
import { THRESHOLDS } from '../services/cjr/cjrConstants';

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

  useEffect(() => {
    const link = setInterval(() => {
      const state = gameStateRef.current;
      if (!state || !state.player) return;

      setMatchPercent(state.player.matchPercent);
      setCurrentRing(state.player.ring);
      setScore(Math.floor(state.player.score));

      // Calculate Next Requirement
      let req = 0;
      if (state.player.ring === 1) req = THRESHOLDS.INTO_RING2;
      else if (state.player.ring === 2) req = THRESHOLDS.INTO_RING3;
      else req = THRESHOLDS.WIN_HOLD;
      setNextReq(req);

      setWinTimer(state.player.stationaryTime || 0);
    }, 100);
    return () => clearInterval(link);
  }, []); // Ref dependency omitted on purpose for interval loop

  // Visuals
  const percent = Math.floor(matchPercent * 100);
  const reqPercent = Math.floor(nextReq * 100);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top Bar: Match % */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="text-white font-bold text-shadow text-xl mb-1">
          RING {currentRing} - TARGET: {reqPercent}%
        </div>

        <div className="w-64 h-6 bg-gray-800 rounded-full border-2 border-white relative overflow-hidden">
          {/* Progress */}
          <div
            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-300"
            style={{ width: `${Math.min(100, percent)}%` }}
          />

          {/* Marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white z-10"
            style={{ left: `${reqPercent}%` }}
          />
        </div>
        <div className="text-white font-mono mt-1">{percent}% MATCH</div>
      </div>

      {/* Score */}
      <div className="absolute top-4 left-4 text-white font-bold text-2xl drop-shadow-md">
        SCORE: {score}
      </div>

      {/* Win Channeling Alert */}
      {winTimer > 0 && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 flex flex-col items-center animate-pulse">
          <div className="text-yellow-400 font-black text-4xl stroke-black">
            SECURING VICTORY
          </div>
          <div className="w-40 h-4 bg-gray-900 mt-2 rounded">
            <div className="h-full bg-yellow-400" style={{ width: `${(winTimer / 1.5) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default HUD;
