import { Packet } from '../hooks/usePacketInterceptor';

interface PacketListProps {
  packets: Packet[];
  selectedId: number | null;
  onSelect: (packet: Packet) => void;
}

export function PacketList({ packets, selectedId, onSelect }: PacketListProps) {
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    });
  };

  const getTypeName = (type: number) => {
    switch (type) {
      case 1: return 'TRANSFORM';
      case 2: return 'EVENT';
      case 3: return 'INPUT';
      default: return `TYPE_${type}`;
    }
  };

  return (
    <div className="packet-list">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Dir</th>
            <th>Type</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {packets.map(packet => (
            <tr 
              key={packet.id}
              className={selectedId === packet.id ? 'selected' : ''}
              onClick={() => onSelect(packet)}
            >
              <td>{packet.id}</td>
              <td>{formatTime(packet.timestamp)}</td>
              <td className={packet.direction}>{packet.direction === 'in' ? '←' : '→'}</td>
              <td>{getTypeName(packet.type)}</td>
              <td>{packet.size} B</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
