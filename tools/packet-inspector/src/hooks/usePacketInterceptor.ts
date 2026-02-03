import { useState, useEffect, useCallback } from 'react';

export interface Packet {
  id: number;
  timestamp: number;
  direction: 'in' | 'out';
  type: number;
  size: number;
  data: ArrayBuffer;
  decoded?: unknown;
}

export function usePacketInterceptor(wsUrl: string = 'ws://localhost:8093') {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'PACKET') {
        setPackets(prev => [...prev.slice(-999), {
          ...data.packet,
          data: new Uint8Array(data.packet.data).buffer
        }]);
      }
    };

    return () => ws.close();
  }, [wsUrl]);

  const toggleRecording = useCallback(() => {
    setIsRecording(prev => !prev);
  }, []);

  const clearPackets = useCallback(() => {
    setPackets([]);
  }, []);

  const exportPackets = useCallback(() => {
    const blob = new Blob([JSON.stringify(packets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packets_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [packets]);

  return {
    packets,
    isRecording,
    isConnected,
    toggleRecording,
    clearPackets,
    exportPackets
  };
}
