
import { NetworkClient } from '../network/NetworkClient';
// import { BinaryPacker } from '@cjr/engine/networking';

// Internal type for captured packets
export interface CapturedPacket {
    id: number;
    direction: 'send' | 'receive';
    type: number | string;
    timestamp: number;
    size: number;
    data: ArrayBuffer | any;
    decoded: any;
}

export class PacketInterceptor {
    private static instance: PacketInterceptor;
    private ws: WebSocket | null = null;
    private packets: CapturedPacket[] = [];
    private recording = true; // Auto-record on dev
    private packetIdCounter = 0;
    private bufferSize = 1000;
    private serverUrl = 'ws://localhost:8093'; // Packet Inspector Server

    // Reconnect logic
    private reconnectInterval = 3000;
    private reconnectTimer: any = null;

    private constructor() {
        this.connect();
    }

    public static getInstance(): PacketInterceptor {
        if (!PacketInterceptor.instance) {
            PacketInterceptor.instance = new PacketInterceptor();
        }
        return PacketInterceptor.instance;
    }

    private connect() {
        if (this.ws?.readyState === WebSocket.OPEN) return;

        try {
            this.ws = new WebSocket(this.serverUrl);
            this.ws.onopen = () => {
                console.log('[PacketInterceptor] Connected to inspector');
                if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            };

            this.ws.onclose = () => {
                console.log('[PacketInterceptor] Disconnected');
                this.scheduleReconnect();
            };

            this.ws.onerror = (err) => {
                // console.error('[PacketInterceptor] Error:', err);
            };
        } catch (e) {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectInterval);
    }

    public install(networkClient: NetworkClient) {
        if (!import.meta.env.DEV) return;

        console.log('[PacketInterceptor] Installing hook into NetworkClient');

        // Hook 'send' (We need to access the client inside NetworkClient, but it's private.
        // Instead, we can wrap the colyseus client methods if possible, 
        // OR we modify NetworkClient to allow hooking.

        // Since NetworkClient doesn't expose a raw 'send' easily, 
        // we might need to rely on the NetworkClient explicitly calling us.
        // Ideally, we modify NetworkClient to call PacketInterceptor.capture()
    }

    public captureReceive(data: any) {
        if (!this.recording) return;
        this.processPacket('receive', data);
    }

    public captureSend(data: any) {
        if (!this.recording) return;
        this.processPacket('send', data);
    }

    private processPacket(direction: 'send' | 'receive', data: any) {
        try {
            let size = 0;
            let raw: ArrayBuffer | null = null;
            let decoded: any = { note: 'Not decoded' };
            let type: number | string = '?';

            // Identify data type
            if (data instanceof ArrayBuffer) {
                size = data.byteLength;
                raw = data;
                // Attempt decode with BinaryPacker if it looks like our binary format
                try {
                    // Helper to peek type
                    const view = new DataView(data);
                    if (data.byteLength > 0) {
                        type = view.getUint8(0);
                        // We can try to full decode if needed, but it might be expensive.
                        // Ideally BinaryPacker has a 'decode' method that returns an object
                        // For now we just send raw and let the Inspector decode?
                        // The proposal said Inspector UI does decoding, but passing raw AB over WS to Inspector is fine.

                        // Wait, we need to send this packet TO the inspector.
                        // JSON.stringify can't handle ArrayBuffer.
                    }
                } catch (e) { }
            } else {
                // JSON packet
                size = JSON.stringify(data).length; // rough estimate
                decoded = data;
                type = 'JSON';
            }

            const packet: CapturedPacket = {
                id: this.packetIdCounter++,
                direction,
                type,
                timestamp: Date.now(),
                size,
                data: raw ? Array.from(new Uint8Array(raw)) : data, // Serialize AB
                decoded
            };

            this.packets.push(packet);
            if (this.packets.length > this.bufferSize) this.packets.shift();

            // Broadcast
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Wrap in envelope
                this.ws.send(JSON.stringify({ type: 'PACKET', packet }));
            }
        } catch (e) {
            console.error('[PacketInterceptor] Failed to process packet', e);
        }
    }
}
