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
    public onWalletUpdate: ((gold: number, gems: number) => void) | null = null;

    // Current user state
    public wallet = { gold: 0, gems: 0 };
    public battlePass = { level: 1, xp: 0, isPremium: false };
    public onBattlePassUpdate: ((level: number, xp: number, isPremium: boolean) => void) | null = null;

    private static instance: NetworkManager;

    private constructor() {
        this.client = new Client(CONFIG.WS_URL);
    }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
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

            // Player State Sync
            this.room.state.players.onAdd((player: any, sessionId: string) => {
                if (sessionId === this.room.sessionId) {
                    // This is ME
                    this.updateWallet(player.wallet);

                    player.wallet.onChange(() => {
                        this.updateWallet(player.wallet);
                    });

                    // Initial BP
                    this.updateBattlePass(player.battlePass);
                    player.battlePass.onChange(() => {
                        this.updateBattlePass(player.battlePass);
                    });
                }
            });

            return seed || "0";

        } catch (e) {
            console.error("Join failed", e);
            throw e;
        }
    }

    private updateWallet(walletState: any) {
        this.wallet.gold = walletState.gold;
        this.wallet.gems = walletState.gems;
        if (this.onWalletUpdate) this.onWalletUpdate(this.wallet.gold, this.wallet.gems);
    }

    private updateBattlePass(bpState: any) {
        this.battlePass.level = bpState.level;
        this.battlePass.xp = bpState.xp;
        this.battlePass.isPremium = bpState.isPremium;
        if (this.onBattlePassUpdate) this.onBattlePassUpdate(this.battlePass.level, this.battlePass.xp, this.battlePass.isPremium);
    }

    public sendAction(type: string, data: any) {
        if (this.room) {
            this.room.send("input", { type, data });
        }
    }
}
