import React, { useEffect, useState, useRef } from 'react';
import { Application } from 'pixi.js';

interface HUDProps {
    app: Application | null;
    stats: {
        multiplier: number;
        chainLength: number;
        avatarState: boolean;
    };
}

export const PerformanceHUD: React.FC<HUDProps> = ({ app, stats }) => {
    const [fps, setFps] = useState(0);
    const [avgFps, setAvgFps] = useState(0);
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const fpsHistoryRef = useRef<number[]>([]);

    useEffect(() => {
        if (!app) return;

        const updateFps = () => {
            const now = performance.now();
            frameCountRef.current++;

            if (now - lastTimeRef.current >= 1000) {
                const currentFps = frameCountRef.current;
                setFps(currentFps);

                fpsHistoryRef.current.push(currentFps);
                if (fpsHistoryRef.current.length > 60) fpsHistoryRef.current.shift();

                const sum = fpsHistoryRef.current.reduce((a, b) => a + b, 0);
                setAvgFps(Math.round(sum / fpsHistoryRef.current.length));

                frameCountRef.current = 0;
                lastTimeRef.current = now;
            }

            requestAnimationFrame(updateFps);
        };

        const animationId = requestAnimationFrame(updateFps);
        return () => cancelAnimationFrame(animationId);
    }, [app]);

    return (
        <div className="absolute top-4 left-4 p-4 bg-black/80 border border-green-500/30 rounded-lg backdrop-blur-sm text-green-400 font-mono text-xs shadow-lg pointer-events-none select-none z-50">
            <h3 className="text-green-300 font-bold mb-2 border-b border-green-500/30 pb-1">EIDOLON-V ENGINE</h3>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <span className="text-gray-400">FPS:</span>
                <span className={`font-bold ${fps < 55 ? 'text-red-400' : 'text-green-400'}`}>{fps}</span>

                <span className="text-gray-400">AVG (60s):</span>
                <span>{avgFps}</span>

                <div className="col-span-2 h-px bg-green-500/20 my-1"></div>

                <span className="text-gray-400">MULTIPLIER:</span>
                <span className="text-yellow-400">x{stats.multiplier}</span>

                <span className="text-gray-400">CHAIN:</span>
                <span className="text-blue-400">{stats.chainLength}</span>

                <span className="text-gray-400">STATE:</span>
                <span className={stats.avatarState ? 'text-purple-400 font-bold animate-pulse' : 'text-gray-500'}>
                    {stats.avatarState ? 'AVATAR' : 'NORMAL'}
                </span>

                <div className="col-span-2 h-px bg-green-500/20 my-1"></div>

                <span className="text-gray-400">RENDERER:</span>
                <span>WebGPU (WASM)</span>
            </div>
        </div>
    );
};
