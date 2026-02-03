import { useState, useEffect } from 'react';
import { GameSnapshot } from '../hooks/useStateSnapshot';

interface TimelineProps {
  snapshots: GameSnapshot[];
  currentFrame: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onSeek: (frame: number) => void;
}

export function Timeline({ 
  snapshots, 
  currentFrame, 
  isPaused, 
  onPause, 
  onResume, 
  onStep, 
  onSeek 
}: TimelineProps) {
  const [fps, setFps] = useState(60);
  const maxFrame = snapshots.length > 0 ? snapshots[snapshots.length - 1].frame : 0;

  useEffect(() => {
    if (snapshots.length < 2) return;
    
    const last10 = snapshots.slice(-10);
    if (last10.length >= 2) {
      const timeSpan = last10[last10.length - 1].timestamp - last10[0].timestamp;
      const frames = last10.length - 1;
      if (timeSpan > 0) {
        setFps(Math.round((frames / timeSpan) * 1000));
      }
    }
  }, [snapshots]);

  return (
    <div className="timeline-controls">
      <div className="playback-buttons">
        <button onClick={isPaused ? onResume : onPause}>
          {isPaused ? '▶ Play' : '⏸ Pause'}
        </button>
        <button onClick={onStep} disabled={!isPaused}>
          ⏭ Step
        </button>
      </div>

      <div className="timeline-slider">
        <input
          type="range"
          min={0}
          max={maxFrame}
          value={currentFrame}
          onChange={(e) => onSeek(parseInt(e.target.value))}
          disabled={!isPaused}
        />
        <span className="frame-info">
          Frame: {currentFrame} / {maxFrame}
        </span>
      </div>

      <div className="stats">
        <span>FPS: {fps}</span>
        <span>Snapshots: {snapshots.length}</span>
      </div>
    </div>
  );
}
