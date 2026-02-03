import { Packet } from '../hooks/usePacketInterceptor';

interface PacketTimelineProps {
  packets: Packet[];
  selectedId: number | null;
  onSelect: (packet: Packet) => void;
}

export function PacketTimeline({ packets, selectedId, onSelect }: PacketTimelineProps) {
  // Group packets into 100ms buckets
  const bucketSize = 100;
  const buckets: Map<number, Packet[]> = new Map();
  
  if (packets.length > 1) {
    const startTime = packets[0].timestamp;
    packets.forEach(packet => {
      const bucketIndex = Math.floor((packet.timestamp - startTime) / bucketSize);
      if (!buckets.has(bucketIndex)) {
        buckets.set(bucketIndex, []);
      }
      buckets.get(bucketIndex)!.push(packet);
    });
  }

  const maxPacketsInBucket = Math.max(...Array.from(buckets.values()).map(b => b.length), 1);
  const bucketArray = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div className="packet-timeline">
      <div className="timeline-header">
        <span>Packet Timeline (100ms buckets)</span>
        <span className="legend">
          <span className="in">■ In</span>
          <span className="out">■ Out</span>
        </span>
      </div>
      
      <div className="timeline-bars">
        {bucketArray.slice(-50).map(([index, bucketPackets]) => {
          const inCount = bucketPackets.filter(p => p.direction === 'in').length;
          const outCount = bucketPackets.filter(p => p.direction === 'out').length;
          const inHeight = (inCount / maxPacketsInBucket) * 100;
          const outHeight = (outCount / maxPacketsInBucket) * 100;
          
          const hasSelected = bucketPackets.some(p => p.id === selectedId);
          
          return (
            <div 
              key={index} 
              className={`timeline-bar ${hasSelected ? 'selected' : ''}`}
              onClick={() => onSelect(bucketPackets[bucketPackets.length - 1])}
              title={`${inCount} in, ${outCount} out`}
            >
              <div className="bar-stack">
                <div className="bar-in" style={{ height: `${inHeight}%` }} />
                <div className="bar-out" style={{ height: `${outHeight}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
