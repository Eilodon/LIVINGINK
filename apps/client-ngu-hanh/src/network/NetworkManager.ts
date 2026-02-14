import { Client } from 'colyseus.js';

interface EntityData {
    id: number;
    pos: { x: number; y: number; onChange?: (callback: () => void) => void };
    [key: string]: unknown;
}

import { CONFIG } from '../config';

export class NetworkManager {
    private client: Client;
    private room: any; // Colyseus room type is complex, using any for now
    private entities = new Map<number, EntityData>();
    public onEntityAdd: ((id: number, data: EntityData) => void) | null = null;
    public onEntityRemove: ((id: number) => void) | null = null;

    constructor() {
        this.client = new Client(CONFIG.WS_URL);
    }

    async connect(): Promise<string> {
        try {
            // Retrieve token from localStorage or generate temporary guest ID
            let token = localStorage.getItem('ngu_hanh_token');
            if (!token) {
                // For now, let server generate guest profile. 
                // Next time we could store the returned ID if we implement full handshake.
                // Sending empty token implies Guest request.
            }

            this.room = await this.client.joinOrCreate("ngu_hanh", { token });

            // Save token if server returns it (need handshake update later)

            console.log("Joined room!", this.room.sessionId);

            // Wait for initial state if not immediately available? 
            // Schema state is usually available on join.
            // But to be safe, we can check.
            const seed = this.room.state.seed;
            console.log("Received Seed from Server:", seed);

            // Setup listeners
            this.room.state.entities.onAdd((entity: EntityData) => {
                this.entities.set(entity.id, entity);
                if (this.onEntityAdd) this.onEntityAdd(entity.id, entity);
                entity.pos.onChange?.(() => { });
            });

            this.room.state.entities.onRemove((entity: EntityData) => {
                this.entities.delete(entity.id);
                if (this.onEntityRemove) this.onEntityRemove(entity.id);
            });

            return seed || "0";

        } catch (e) {
            console.error("Join failed", e);
            throw e;
        }
    }
}
