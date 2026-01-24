import React, { useEffect, useMemo, useState } from 'react';
import type { ShapeId } from '../../services/cjr/cjrTypes';
import type { MatchmakingStatus } from '../../services/meta/matchmaking';

type Props = {
  name: string;
  shape: ShapeId;
  region: string;
  status: MatchmakingStatus;
  queuedAt?: number;
  networkStatus: 'offline' | 'connecting' | 'online' | 'reconnecting' | 'error';
  onRegionChange: (region: string) => void;
  onQueue: () => void;
  onCancel: () => void;
  onBack: () => void;
  onEnterMatch: () => void;
};

const REGIONS = ['NA', 'EU', 'ASIA', 'SA', 'OCE'];

const MatchmakingScreen: React.FC<Props> = ({
  name,
  shape,
  region,
  status,
  queuedAt,
  networkStatus,
  onRegionChange,
  onQueue,
  onCancel,
  onBack,
  onEnterMatch,
}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'queuing') return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [status]);

  const statusText = useMemo(() => {
    if (status === 'matched') return 'MATCH FOUND';
    if (status === 'failed') return 'QUEUE FAILED';
    if (status === 'queuing') return 'SEARCHING';
    return 'IDLE';
  }, [status]);

  const statusColor = useMemo(() => {
    if (status === 'matched') return 'text-emerald-300';
    if (status === 'failed') return 'text-rose-300';
    if (status === 'queuing') return 'text-amber-300';
    return 'text-slate-400';
  }, [status]);

  const networkColor = useMemo(() => {
    if (networkStatus === 'online') return 'text-emerald-300';
    if (networkStatus === 'connecting' || networkStatus === 'reconnecting') return 'text-amber-300';
    if (networkStatus === 'error') return 'text-rose-300';
    return 'text-slate-400';
  }, [networkStatus]);

  const queuedSeconds = useMemo(() => {
    if (status !== 'queuing' || !queuedAt) return 0;
    return Math.max(0, Math.floor((now - queuedAt) / 1000));
  }, [now, queuedAt, status]);

  const canQueue = Boolean(name.trim());

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 text-white">
      <div className="ritual-panel w-full max-w-3xl mx-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="ritual-kicker text-xs">Matchmaking</div>
            <div className="ritual-title text-2xl mt-2">Enter The Arena</div>
          </div>
          <button onClick={onBack} className="ritual-button ritual-button-ghost text-[0.65rem] px-3 py-2">
            BACK
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="ritual-card">
            <div className="text-xs text-[color:var(--mist-400)]">PLAYER</div>
            <div className="text-lg font-bold mt-2">{name || 'Anonymous'}</div>
            <div className="text-xs text-[color:var(--mist-400)] uppercase mt-1">Shape: {shape}</div>
          </div>

          <div className="ritual-card">
            <div className="text-xs text-[color:var(--mist-400)]">REGION</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => onRegionChange(r)}
                  className={`px-3 py-1 rounded border text-xs font-bold tracking-widest ${r === region ? 'border-[color:rgba(47,141,110,0.6)] text-emerald-200 bg-[rgba(47,141,110,0.2)]' : 'border-[color:rgba(225,214,200,0.2)] text-[color:var(--mist-400)]'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="ritual-card">
            <div className="text-xs text-[color:var(--mist-400)]">STATUS</div>
            <div className={`text-lg font-bold mt-2 ${statusColor}`}>{statusText}</div>
            <div className="text-xs text-[color:var(--mist-400)] mt-1">NET <span className={networkColor}>{networkStatus.toUpperCase()}</span></div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[color:rgba(225,214,200,0.16)] bg-[rgba(24,20,30,0.7)] p-4 text-sm text-[color:var(--bone-200)]">
          {status === 'queuing' && <div>Searching in {region}… {queuedSeconds}s elapsed</div>}
          {status === 'matched' && <div className="text-emerald-200 font-bold">Match found. Ready to deploy.</div>}
          {status === 'failed' && <div className="text-rose-200 font-bold">Matchmaking failed. Try again.</div>}
          {status === 'idle' && <div>Queue up to enter competitive arena.</div>}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {status === 'idle' && (
            <button
              onClick={onQueue}
              disabled={!canQueue}
              className={`ritual-button ${canQueue ? 'ritual-button-emerald' : 'ritual-button-muted opacity-60 cursor-not-allowed'}`}
            >
              QUEUE
            </button>
          )}
          {status === 'queuing' && (
            <button
              onClick={onCancel}
              className="ritual-button ritual-button-primary"
            >
              CANCEL
            </button>
          )}
          {status === 'matched' && (
            <button
              onClick={onEnterMatch}
              className="ritual-button ritual-button-emerald"
            >
              ENTER MATCH
            </button>
          )}
          {status === 'failed' && (
            <button
              onClick={onQueue}
              className="ritual-button ritual-button-primary"
            >
              RETRY
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchmakingScreen;
