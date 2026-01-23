import React, { useEffect, useRef } from 'react';
import { GameState, Faction } from '../types';
import { GAME_DURATION, FACTION_CONFIG, SPAWN_PROTECTION_TIME } from '../constants';
import { getMutationById } from '../services/mutations';

interface HUDProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  isTouchInput?: boolean;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[char] || char;
  });

const HUD: React.FC<HUDProps> = ({ gameStateRef, isTouchInput = false }) => {
  // Direct DOM refs to bypass React render cycle for high-frequency updates
  const hpBarRef = useRef<HTMLDivElement>(null);
  const hpTextRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const cooldownRef = useRef<HTMLDivElement>(null);
  const cooldownOverlayRef = useRef<HTMLDivElement>(null);
  const cooldownTextRef = useRef<HTMLSpanElement>(null);
  const roundRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const leaderBoardRef = useRef<HTMLDivElement>(null);
  const mutationRef = useRef<HTMLDivElement>(null);
  const lastStatsUpdateRef = useRef(0);

  // We only render the static parts once.
  // Dynamic parts are updated via a lightweight loop.

  const player = gameStateRef.current?.player;
  const factionData = player ? FACTION_CONFIG[player.faction] : FACTION_CONFIG[Faction.Fire];

  useEffect(() => {
    let animationFrameId: number;

    const updateHUD = (time?: number) => {
      const state = gameStateRef.current;
      if (!state) return;
      const { player, bots, gameTime, currentRound } = state;
      const now = time || performance.now();

      // 1. Update HP
      if (hpBarRef.current && hpTextRef.current) {
        const hpPercent = Math.max(0, (player.currentHealth / player.maxHealth) * 100);
        hpBarRef.current.style.width = `${hpPercent}%`;
        hpTextRef.current.innerText = `${Math.ceil(player.currentHealth)}/${Math.ceil(player.maxHealth)}`;
      }

      // 2. Update Timer
      if (timerRef.current) {
        const remaining = Math.max(0, GAME_DURATION - gameTime);
        const m = Math.floor(remaining / 60);
        const s = Math.floor(remaining % 60);
        timerRef.current.innerText = `${m}:${s.toString().padStart(2, '0')}`;
      }

      // 3. Update Score & Kills (throttled)
      const shouldUpdateStats = now - lastStatsUpdateRef.current > 150;
      if (shouldUpdateStats && scoreRef.current) {
        scoreRef.current.innerHTML = `
           <div class="text-slate-400 text-xs uppercase tracking-wider">Score</div>
           <div class="text-2xl font-bold text-white">${Math.floor(player.score)}</div>
           <div class="text-slate-400 text-xs mt-2">Kills: <span class="text-red-400 font-bold">${player.kills}</span></div>
        `;
      }

      // 4. Update Cooldown UI
      if (cooldownOverlayRef.current && cooldownTextRef.current && cooldownRef.current) {
        if (player.skillCooldown > 0) {
          cooldownOverlayRef.current.style.display = 'flex';
          cooldownTextRef.current.innerText = player.skillCooldown.toFixed(1);
          cooldownRef.current.classList.remove('border-yellow-400', 'shadow-[0_0_15px_rgba(250,204,21,0.5)]');
          cooldownRef.current.classList.add('border-slate-600');
        } else {
          cooldownOverlayRef.current.style.display = 'none';
          cooldownRef.current.classList.add('border-yellow-400', 'shadow-[0_0_15px_rgba(250,204,21,0.5)]');
          cooldownRef.current.classList.remove('border-slate-600');
        }
      }

      // 5. Update Evolution Progress
      if (progressRef.current) {
        const progressPercent = Math.min(100, (player.radius / 200) * 100);
        progressRef.current.style.width = `${progressPercent}%`;
      }

      // 6. Round Text
      if (roundRef.current) {
        if (currentRound === 4) {
          roundRef.current.innerText = "SUDDEN DEATH";
          roundRef.current.className = "text-red-500 animate-pulse";
        } else {
          roundRef.current.innerText = `ROUND ${currentRound} / 3`;
          roundRef.current.className = "text-yellow-500";
        }
      }

      // 7. Leaderboard (throttled)
      if (shouldUpdateStats && leaderBoardRef.current) {
        const allEntities = [player, ...bots].sort((a, b) => b.radius - a.radius).slice(0, 5);
        let html = '';
        allEntities.forEach((e, idx) => {
          const isMe = e.id === player.id;
          const safeName = escapeHtml(e.name || 'Bot');
          html += `
             <div class="flex justify-between text-xs ${isMe ? 'text-white font-bold' : 'text-slate-400'}">
                 <span>#${idx + 1} ${safeName}</span>
                 <span class="text-yellow-600 font-mono">${Math.floor(e.score)}</span>
             </div>
          `;
        });
        leaderBoardRef.current.innerHTML = html;
      }

      if (shouldUpdateStats && mutationRef.current) {
        const list = player.mutations
          .slice(0, 6)
          .map((id) => getMutationById(id)?.name || String(id))
          .map((name) => escapeHtml(name));
        mutationRef.current.innerHTML = list.length
          ? list.map((name) => `<div class="text-[10px] text-slate-300">${name}</div>`).join('')
          : `<div class="text-[10px] text-slate-500">No mutations</div>`;
      }

      if (shouldUpdateStats) lastStatsUpdateRef.current = now;

      animationFrameId = requestAnimationFrame(updateHUD);
    };

    updateHUD();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  if (!player) return null;

  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        {/* Player Stats */}
        <div className="bg-slate-900 bg-opacity-80 backdrop-blur-sm p-4 rounded-xl border border-slate-700 min-w-[240px]">
          <h3 className="font-fantasy text-yellow-500 text-lg flex items-center gap-2">
            {player.name || 'Unknown'}
          </h3>
          <div className="text-xs text-slate-400 mb-2 flex flex-col">
            <span className="font-bold text-white">{factionData.transformName}</span>
          </div>

          {/* HP Bar */}
          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-1">
            <div ref={hpBarRef} className="h-full bg-red-500 transition-all duration-100" style={{ width: `100%` }}></div>
          </div>
          <div className="flex justify-between text-xs text-slate-300">
            <span>HP</span>
            <span ref={hpTextRef}></span>
          </div>

          <div className="grid grid-cols-2 gap-1 mt-2 border-t border-slate-700 pt-2 text-[10px] text-slate-400 uppercase tracking-wider">
            <div>DMG: <span className="text-white">{player.damageMultiplier.toFixed(1)}x</span></div>
            <div>DEF: <span className="text-white">{player.defense.toFixed(1)}x</span></div>
            <div>SPD: <span className="text-white">{(player.maxSpeed / 5.5).toFixed(1)}x</span></div>
          </div>
          <div className="mt-3 border-t border-slate-700 pt-2">
            <div className="text-[10px] text-yellow-500 font-bold mb-1 uppercase tracking-wider">Mutations</div>
            <div ref={mutationRef} className="flex flex-col gap-0.5"></div>
          </div>
        </div>

        {/* Game Info */}
        <div className="flex flex-col items-center">
          <div className="bg-slate-900 bg-opacity-90 px-6 py-2 rounded-b-xl border-x border-b border-slate-700 shadow-lg">
            <span ref={timerRef} className="font-mono text-2xl font-bold text-white tracking-widest">0:00</span>
          </div>

          <div className="mt-2 text-white font-fantasy text-lg tracking-widest text-shadow-sm flex flex-col items-center">
            <span ref={roundRef}></span>
          </div>
        </div>

        {/* Leaderboard & Score */}
        <div className="flex flex-col gap-2 items-end">
          <div className="bg-slate-900 bg-opacity-80 backdrop-blur-sm p-4 rounded-xl border border-slate-700 min-w-[200px]">
            <h4 className="text-yellow-500 font-bold text-xs uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Leaderboard</h4>
            <div ref={leaderBoardRef} className="flex flex-col gap-1"></div>
          </div>

          <div ref={scoreRef} className="bg-slate-900 bg-opacity-80 backdrop-blur-sm p-4 rounded-xl border border-slate-700 text-right min-w-[150px]">
          </div>
        </div>
      </div>

      {/* Bottom Area */}
      <div className="w-full flex justify-between items-end pb-4">

        {/* Skill Indicator */}
        <div className="flex flex-col items-center ml-4 mb-8">
          <div ref={cooldownRef} className="w-16 h-16 rounded-full border-2 flex items-center justify-center relative bg-slate-800 border-slate-600">
            <div ref={cooldownOverlayRef} className="absolute inset-0 bg-black bg-opacity-60 rounded-full flex items-center justify-center z-10" style={{ display: 'none' }}>
              <span ref={cooldownTextRef} className="text-white font-bold"></span>
            </div>
            <span className="text-2xl z-0">{factionData.icon}</span>
          </div>
          <div className="text-xs text-yellow-500 font-bold mt-8">{factionData.skillName}</div>
        </div>

        {/* Evolution Bar */}
        <div className="flex-1 max-w-2xl mx-8">
          <div className="flex justify-between text-xs font-bold text-slate-300 mb-1 px-1">
            <span>EVOLUTION PROGRESS</span>
          </div>
          <div className="h-4 bg-slate-800 rounded-full border border-slate-600 overflow-hidden relative">
            <div ref={progressRef}
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `0%` }}
            ></div>
            <div className="absolute top-0 left-[20%] w-0.5 h-full bg-black opacity-30"></div>
            <div className="absolute top-0 left-[40%] w-0.5 h-full bg-black opacity-30"></div>
            <div className="absolute top-0 left-[60%] w-0.5 h-full bg-black opacity-30"></div>
            <div className="absolute top-0 left-[80%] w-0.5 h-full bg-black opacity-30"></div>
          </div>
          <div className="text-center text-[10px] text-slate-500 mt-1">
            {isTouchInput ? 'TAP EJECT • TAP SKILL' : "PRESS 'W' TO EJECT MASS • PRESS 'SPACE' FOR SKILL"}
          </div>
        </div>

        <div className="w-16 mr-4"></div>
      </div>
    </div>
  );
};

export default HUD;
