import React, { useMemo } from 'react';
import type { TournamentQueueState, TournamentParticipant } from '../../services/meta/tournaments';

type TournamentInfo = {
  id: string;
  name: string;
  format: 'elimination' | 'round_robin' | 'swiss';
  startsIn: string;
};

type Props = {
  queue: TournamentQueueState;
  onQueue: (tournamentId: string) => void;
  onCancel: () => void;
  onBack: () => void;
};

const TOURNAMENTS: TournamentInfo[] = [
  { id: 'tourney_mystic', name: 'Mystic Trials', format: 'elimination', startsIn: '12m' },
  { id: 'tourney_vortex', name: 'Vortex Clash', format: 'swiss', startsIn: '28m' },
  { id: 'tourney_ember', name: 'Ember Cup', format: 'round_robin', startsIn: '45m' },
];

const TournamentLobbyScreen: React.FC<Props> = ({ queue, onQueue, onCancel, onBack }) => {
  const statusLabel = useMemo(() => {
    if (queue.status === 'queued') return 'QUEUED';
    if (queue.status === 'ready') return 'READY';
    if (queue.status === 'failed') return 'FAILED';
    return 'IDLE';
  }, [queue.status]);

  const statusColor = useMemo(() => {
    if (queue.status === 'ready') return 'text-emerald-300';
    if (queue.status === 'queued') return 'text-amber-300';
    if (queue.status === 'failed') return 'text-rose-300';
    return 'text-slate-400';
  }, [queue.status]);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 text-white">
      <div className="ritual-panel w-full max-w-4xl mx-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="ritual-kicker text-xs">Tournament Lobby</div>
            <div className="ritual-title text-2xl mt-2">Compete For Glory</div>
          </div>
          <button onClick={onBack} className="ritual-button ritual-button-ghost text-[0.65rem] px-3 py-2">
            BACK
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3 text-sm">
          <div className="text-[color:var(--mist-400)]">QUEUE STATUS</div>
          <div className={`font-bold ${statusColor}`}>{statusLabel}</div>
          {queue.tournamentId && <div className="text-[color:var(--mist-400)]">· {queue.tournamentId}</div>}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {TOURNAMENTS.map((tourney) => (
            <div key={tourney.id} className="ritual-card">
              <div className="text-xs text-[color:var(--mist-400)] uppercase tracking-widest">{tourney.format}</div>
              <div className="text-lg font-bold mt-2">{tourney.name}</div>
              <div className="text-xs text-[color:var(--mist-400)] mt-1">Starts in {tourney.startsIn}</div>
              <div className="mt-4">
                <button
                  onClick={() => onQueue(tourney.id)}
                  className="w-full py-2 rounded border border-[color:rgba(47,141,110,0.6)] text-emerald-200 text-xs font-bold tracking-widest hover:bg-[rgba(47,141,110,0.2)] transition"
                >
                  QUEUE
                </button>
              </div>
            </div>
          ))}
        </div>

        {queue.status === 'queued' && (
          <div className="mt-6 flex items-center justify-between rounded-xl bg-[rgba(24,20,30,0.7)] border border-[color:rgba(225,214,200,0.16)] p-4">
            <div className="text-sm text-[color:var(--bone-200)]">Waiting for enough contenders…</div>
            <button onClick={onCancel} className="ritual-button ritual-button-primary text-xs px-4 py-2">
              LEAVE
            </button>
          </div>
        )}

        {queue.status === 'ready' && (
          <div className="mt-6 rounded-xl bg-[rgba(24,20,30,0.7)] border border-[color:rgba(47,141,110,0.5)] p-4">
            <div className="text-emerald-200 font-bold">Tournament ready. Assemble your bracket.</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[color:var(--bone-200)]">
              {(queue.participants || []).map((p: TournamentParticipant) => (
                <div key={p.id} className="px-3 py-2 rounded bg-[rgba(20,16,24,0.8)] border border-[color:rgba(225,214,200,0.12)]">
                  {p.name} · {p.rating}
                </div>
              ))}
            </div>
          </div>
        )}

        {queue.status === 'failed' && (
          <div className="mt-6 rounded-xl bg-[rgba(24,20,30,0.7)] border border-[color:rgba(176,74,74,0.5)] p-4 text-rose-200">
            Queue failed. Try another tournament.
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentLobbyScreen;
