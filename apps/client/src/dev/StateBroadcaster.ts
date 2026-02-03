
import {
    TransformStore,
    PhysicsStore,
    StateStore,
    StatsStore,
    EntityFlags,
    MAX_ENTITIES
} from '@cjr/engine';
import { EntityLookup } from '../game/engine/dod/ComponentStores';

interface EntitySnapshot {
    id: number; // Index
    flags: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    hp: number;
    type: string;
}

export class StateBroadcaster {
    private static instance: StateBroadcaster;
    private ws: WebSocket | null = null;
    private serverUrl = 'ws://localhost:8092'; // State Viewer Server
    private reconnectTimer: any = null;
    private frameCount = 0;
    private broadcastRate = 2; // Every 2 frames (30fps)

    private constructor() {
        this.connect();
    }

    public static getInstance(): StateBroadcaster {
        if (!StateBroadcaster.instance) {
            StateBroadcaster.instance = new StateBroadcaster();
        }
        return StateBroadcaster.instance;
    }

    private connect() {
        if (this.ws?.readyState === WebSocket.OPEN) return;

        try {
            this.ws = new WebSocket(this.serverUrl);
            this.ws.onopen = () => {
                console.log('[StateBroadcaster] Connected to viewer');
                if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            };
            this.ws.onclose = () => {
                this.scheduleReconnect();
            };
            this.ws.onerror = () => { };
        } catch (e) {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 2000);
    }

    public update() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Throttle
        this.frameCount++;
        if (this.frameCount % this.broadcastRate !== 0) return;

        const snapshot = this.captureSnapshot();
        this.ws.send(JSON.stringify({
            type: 'STATE_SNAPSHOT',
            timestamp: Date.now(),
            snapshot
        }));
    }

    private captureSnapshot() {
        const entities: EntitySnapshot[] = [];
        const tData = TransformStore.data;
        const pData = PhysicsStore.data;
        const sData = StatsStore.data;
        const flags = StateStore.flags;

        for (let i = 0; i < MAX_ENTITIES; i++) {
            const flag = flags[i];
            if ((flag & EntityFlags.ACTIVE) === 0) continue;

            const tIdx = i * 8;
            const pIdx = i * 8;
            const sIdx = i * 8;

            // Determine type string
            let type = 'unknown';
            if (flag & EntityFlags.PLAYER) type = 'PLAYER';
            else if (flag & EntityFlags.BOT) type = 'BOT';
            else if (flag & EntityFlags.FOOD) type = 'FOOD';
            else if (flag & EntityFlags.PROJECTILE) type = 'PROJECTILE';

            entities.push({
                id: i,
                flags: flag,
                x: tData[tIdx],
                y: tData[tIdx + 1],
                vx: pData[pIdx],
                vy: pData[pIdx + 1],
                radius: pData[pIdx + 4],
                hp: sData[sIdx], // Assuming hp is at offset 0
                type
            });
        }

        return { entities };
    }
}
