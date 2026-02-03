import { useEffect, useRef, useState } from 'react';

export interface EntitySnapshot {
  index: number;
  type: 'player' | 'bot' | 'food' | 'projectile' | 'boss';
  transform: {
    x: number;
    y: number;
    rotation: number;
    scale: number;
  };
  physics: {
    vx: number;
    vy: number;
    mass: number;
    radius: number;
  };
  stats: {
    health: number;
    maxHealth: number;
    score: number;
    matchPercent: number;
  };
  flags: number;
  ring?: number;
  pigment?: { r: number; g: number; b: number };
}

export interface GameSnapshot {
  frame: number;
  timestamp: number;
  entities: EntitySnapshot[];
  gameState: {
    gameTime: number;
    bossActive: boolean;
    rushWindowActive: boolean;
    playerCount: number;
    entityCount: number;
  };
}

export function useStateSnapshot(wsUrl: string = 'ws://localhost:8092') {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[StateViewer] Connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SNAPSHOT') {
          setSnapshot(data.snapshot);
        }
      } catch (err) {
        console.error('[StateViewer] Parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[StateViewer] Disconnected');
      setIsConnected(false);
    };

    return () => ws.close();
  }, [wsUrl]);

  return { snapshot, isConnected };
}
