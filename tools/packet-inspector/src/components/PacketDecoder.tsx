import { useState } from 'react';
import { Packet } from '../hooks/usePacketInterceptor';

interface PacketDecoderProps {
  packet: Packet | null;
}

export function PacketDecoder({ packet }: PacketDecoderProps) {
  const [viewMode, setViewMode] = useState<'decoded' | 'hex' | 'binary'>('decoded');

  if (!packet) {
    return <div className="packet-decoder"><p>Select a packet to decode</p></div>;
  }

  const toHex = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    const rows: string[] = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const row = Array.from(bytes.slice(i, i + 16))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      rows.push(`${i.toString(16).padStart(8, '0')}  ${row}`);
    }
    return rows.join('\n');
  };

  const toBinary = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map(b => b.toString(2).padStart(8, '0'))
      .join(' ');
  };

  const decodeTransform = (buffer: ArrayBuffer) => {
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);
    let offset = 0;
    
    const type = u8[offset++];
    const timestamp = view.getFloat32(offset, true); offset += 4;
    const count = view.getUint16(offset, true); offset += 2;
    
    const entities = [];
    for (let i = 0; i < count; i++) {
      const idLen = u8[offset++];
      const idBytes = u8.slice(offset, offset + idLen);
      const id = new TextDecoder().decode(idBytes);
      offset += idLen;
      
      const x = view.getFloat32(offset, true); offset += 4;
      const y = view.getFloat32(offset, true); offset += 4;
      const vx = view.getFloat32(offset, true); offset += 4;
      const vy = view.getFloat32(offset, true); offset += 4;
      
      entities.push({ id, x, y, vx, vy });
    }
    
    return { type, timestamp, count, entities };
  };

  const renderDecoded = () => {
    if (packet.type === 1) {
      const data = decodeTransform(packet.data);
      return (
        <div className="decoded-transform">
          <div className="header">
            <span>Type: TRANSFORM_UPDATE</span>
            <span>Timestamp: {data.timestamp.toFixed(2)}</span>
            <span>Entities: {data.count}</span>
          </div>
          <table className="entity-table">
            <thead>
              <tr><th>ID</th><th>X</th><th>Y</th><th>VX</th><th>VY</th></tr>
            </thead>
            <tbody>
              {data.entities.map((e, i) => (
                <tr key={i}>
                  <td>{e.id}</td>
                  <td>{e.x.toFixed(2)}</td>
                  <td>{e.y.toFixed(2)}</td>
                  <td>{e.vx.toFixed(2)}</td>
                  <td>{e.vy.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <pre>{JSON.stringify(packet.decoded || {}, null, 2)}</pre>;
  };

  return (
    <div className="packet-decoder">
      <div className="view-tabs">
        <button className={viewMode === 'decoded' ? 'active' : ''} onClick={() => setViewMode('decoded')}>Decoded</button>
        <button className={viewMode === 'hex' ? 'active' : ''} onClick={() => setViewMode('hex')}>Hex</button>
        <button className={viewMode === 'binary' ? 'active' : ''} onClick={() => setViewMode('binary')}>Binary</button>
      </div>
      
      <div className="decoder-content">
        {viewMode === 'decoded' && renderDecoded()}
        {viewMode === 'hex' && <pre className="hex-view">{toHex(packet.data)}</pre>}
        {viewMode === 'binary' && <pre className="binary-view">{toBinary(packet.data)}</pre>}
      </div>
    </div>
  );
}
