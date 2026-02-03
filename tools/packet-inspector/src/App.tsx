import { useState } from 'react';
import { usePacketInterceptor } from './hooks/usePacketInterceptor';
import { PacketList } from './components/PacketList';
import { PacketDecoder } from './components/PacketDecoder';
import { PacketTimeline } from './components/PacketTimeline';
import { PacketStatistics } from './components/PacketStatistics';
import { Packet } from './hooks/usePacketInterceptor';
import './App.css';

function App() {
  const { 
    packets, 
    isRecording, 
    isConnected, 
    toggleRecording, 
    clearPackets, 
    exportPackets 
  } = usePacketInterceptor();
  
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

  const filteredPackets = packets.filter(p => 
    filter === 'all' || p.direction === filter
  );

  return (
    <div className="packet-inspector">
      <header>
        <h1>📡 Packet Inspector</h1>
        <div className="header-right">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <button className={isRecording ? 'recording' : ''} onClick={toggleRecording}>
            {isRecording ? '⏹ Stop' : '⏺ Record'}
          </button>
          <button onClick={clearPackets}>🗑 Clear</button>
          <button onClick={exportPackets}>💾 Export</button>
        </div>
      </header>

      <PacketTimeline 
        packets={filteredPackets}
        selectedId={selectedPacket?.id || null}
        onSelect={setSelectedPacket}
      />

      <div className="stats-bar">
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} title="Filter packets">
          <option value="all">All</option>
          <option value="in">Incoming</option>
          <option value="out">Outgoing</option>
        </select>
      </div>

      <main>
        <div className="left-column">
          <PacketList 
            packets={filteredPackets}
            selectedId={selectedPacket?.id || null}
            onSelect={setSelectedPacket}
          />
          <PacketStatistics packets={packets} />
        </div>
        <PacketDecoder packet={selectedPacket} />
      </main>
    </div>
  );
}

export default App;
