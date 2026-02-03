import { useMemo } from 'react';
import { Packet } from '../hooks/usePacketInterceptor';

interface PacketStatisticsProps {
  packets: Packet[];
}

export function PacketStatistics({ packets }: PacketStatisticsProps) {
  const stats = useMemo(() => {
    const now = Date.now();
    const recentPackets = packets.filter(p => now - p.timestamp < 1000);
    
    const packetsPerSec = recentPackets.length;
    
    const bytesIn = packets
      .filter(p => p.direction === 'in')
      .reduce((sum, p) => sum + p.size, 0);
    const bytesOut = packets
      .filter(p => p.direction === 'out')
      .reduce((sum, p) => sum + p.size, 0);
    
    const bandwidth = (bytesIn + bytesOut) / Math.max(packets.length / 60, 1); // Rough estimate
    
    const byType = packets.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    return {
      total: packets.length,
      packetsPerSec,
      bytesIn,
      bytesOut,
      bandwidth,
      byType,
      avgSize: packets.length > 0 
        ? packets.reduce((sum, p) => sum + p.size, 0) / packets.length 
        : 0
    };
  }, [packets]);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getTypeName = (type: number): string => {
    switch (type) {
      case 1: return 'TRANSFORM';
      case 2: return 'EVENT';
      case 3: return 'INPUT';
      default: return `TYPE_${type}`;
    }
  };

  return (
    <div className="packet-statistics">
      <h4>📊 Statistics</h4>
      
      <div className="stat-row">
        <span>Total Packets:</span>
        <strong>{stats.total.toLocaleString()}</strong>
      </div>
      
      <div className="stat-row">
        <span>Packets/sec:</span>
        <strong>{stats.packetsPerSec}</strong>
      </div>
      
      <div className="stat-row">
        <span>Bandwidth:</span>
        <strong>{formatBytes(stats.bandwidth)}/s</strong>
      </div>
      
      <div className="stat-row">
        <span>Bytes In:</span>
        <strong>{formatBytes(stats.bytesIn)}</strong>
      </div>
      
      <div className="stat-row">
        <span>Bytes Out:</span>
        <strong>{formatBytes(stats.bytesOut)}</strong>
      </div>
      
      <div className="stat-row">
        <span>Avg Size:</span>
        <strong>{stats.avgSize.toFixed(1)} B</strong>
      </div>

      <div className="type-breakdown">
        <h5>By Type</h5>
        {Object.entries(stats.byType)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) => (
            <div key={type} className="type-row">
              <span>{getTypeName(Number(type))}:</span>
              <span>{count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
