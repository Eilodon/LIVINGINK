import React, { useEffect, useState } from 'react';
import { PerformanceManager, PerformanceMetrics, PerformanceTier } from '@cjr/engine';

export const DebugHUD: React.FC = () => {
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setMetrics(PerformanceManager.getInstance().getMetrics());
        }, 500); // 2Hz update

        return () => clearInterval(interval);
    }, []);

    if (!metrics) return null;

    const [replayMode, setReplayMode] = useState<string>('IDLE');

    useEffect(() => {
        // Poll Replay Status
        const interval = setInterval(() => {
            setMetrics(PerformanceManager.getInstance().getMetrics());
            // @ts-ignore
            import('@cjr/game-ngu-hanh').then(m => {
                setReplayMode(m.ReplaySystem.getInstance().mode);
            });
        }, 500);

        return () => clearInterval(interval);
    }, []);

    const handleSave = async () => {
        const m = await import('@cjr/game-ngu-hanh');
        const log = m.ReplaySystem.getInstance().exportLog();
        const blob = new Blob([log], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ngu_hanh_replay_${Date.now()}.json`;
        a.click();
    };

    const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const m = await import('@cjr/game-ngu-hanh');
        const sys = m.ReplaySystem.getInstance();
        if (sys.importLog(text)) {
            sys.saveToLocalStorage();
            window.location.reload();
        }
    };

    const handleStop = async () => {
        const m = await import('@cjr/game-ngu-hanh');
        m.ReplaySystem.getInstance().clearLocalStorage();
        window.location.reload();
    };

    if (!metrics) return null;

    const tierColor = {
        [PerformanceTier.GOD]: '#d4af37',
        [PerformanceTier.HIGH]: '#00ff00',
        [PerformanceTier.MID]: '#ffff00',
        [PerformanceTier.LOW]: '#ff0000',
    }[metrics.tier];

    return (
        <div style={{
            position: 'absolute',
            top: 60,
            left: 20,
            color: 'white',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: '10px',
            borderRadius: '5px',
            pointerEvents: 'auto', // Enable clicking
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 1000
        }}>
            <div>FPS: {metrics.fps.toFixed(0)}</div>
            <div>Frame Time: {metrics.avgFrameTime.toFixed(2)}ms</div>
            <div style={{ color: tierColor, marginBottom: '8px' }}>
                TIER: {PerformanceTier[metrics.tier]}
            </div>

            <div style={{ borderTop: '1px solid #444', paddingTop: '8px', marginTop: '8px' }}>
                <div style={{ color: replayMode === 'RECORD' ? '#ff4444' : replayMode === 'PLAYBACK' ? '#44ff44' : '#888' }}>
                    MODE: {replayMode}
                </div>

                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                    <button onClick={handleSave} style={{ background: '#333', border: '1px solid #555', color: '#fff', cursor: 'pointer', padding: '2px 5px' }}>
                        SAVE
                    </button>
                    <label style={{ background: '#333', border: '1px solid #555', color: '#fff', cursor: 'pointer', padding: '2px 5px' }}>
                        LOAD
                        <input type="file" onChange={handleLoad} style={{ display: 'none' }} accept=".json" />
                    </label>
                    {replayMode === 'PLAYBACK' && (
                        <button onClick={handleStop} style={{ background: '#533', border: '1px solid #755', color: '#fcc', cursor: 'pointer', padding: '2px 5px' }}>
                            STOP
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
