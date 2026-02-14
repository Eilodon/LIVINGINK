
export interface ReplayAction {
    tick: number;
    type: 'SWAP';
    params: any[]; // [r1, c1, r2, c2]
}

export interface ReplayLog {
    seed: string;
    actions: ReplayAction[];
}

export class ReplaySystem {
    private static instance: ReplaySystem;

    public mode: 'RECORD' | 'PLAYBACK' | 'IDLE' = 'IDLE';
    private log: ReplayLog = { seed: "0", actions: [] };
    private currentReplayIndex: number = 0;

    private constructor() {
        // Check for active replay in LocalStorage (for reload persistence)
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('ngu_hanh_replay_active');
            if (saved) {
                console.log("[ReplaySystem] Found active replay in storage. Initializing Playback.");
                const log = this.importLog(saved);
                if (log) {
                    this.startPlayback(log);
                    // Optional: Clear it so next refresh is normal? 
                    // Or keep it until "Stop" is pressed.
                    // For now, let's keep it to ensure it loads, but maybe clear it if we want 'one-shot'.
                    // Let's NOT clear it automatically, allows refreshing to watch again.
                    // User must click "Stop Replay" to clear.
                }
            }
        }
    }

    public static getInstance(): ReplaySystem {
        if (!ReplaySystem.instance) {
            ReplaySystem.instance = new ReplaySystem();
        }
        return ReplaySystem.instance;
    }

    public saveToLocalStorage() {
        if (typeof window !== 'undefined') {
            localStorage.setItem('ngu_hanh_replay_active', this.exportLog());
        }
    }

    public clearLocalStorage() {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('ngu_hanh_replay_active');
        }
    }

    public startRecording(seed: string) {
        this.mode = 'RECORD';
        this.log = { seed, actions: [] };
        console.log(`[ReplaySystem] Started RECORDING with seed: ${seed}`);
    }

    public startPlayback(log: ReplayLog) {
        this.mode = 'PLAYBACK';
        this.log = log;
        this.currentReplayIndex = 0;
        console.log(`[ReplaySystem] Started PLAYBACK with seed: ${log.seed}, actions: ${log.actions.length}`);
    }

    public stop() {
        this.mode = 'IDLE';
    }

    public recordAction(tick: number, type: 'SWAP', ...params: any[]) {
        if (this.mode !== 'RECORD') return;
        this.log.actions.push({ tick, type, params });
        // console.log(`[ReplaySystem] Recorded ${type} at tick ${tick}`, params);
    }

    // Returns actions for the current tick
    public getActions(tick: number): ReplayAction[] {
        if (this.mode !== 'PLAYBACK') return [];

        const actions: ReplayAction[] = [];

        while (this.currentReplayIndex < this.log.actions.length) {
            const action = this.log.actions[this.currentReplayIndex];
            if (action.tick === tick) {
                actions.push(action);
                this.currentReplayIndex++;
            } else if (action.tick < tick) {
                // Missed action? Warning
                console.warn(`[ReplaySystem] Missed action at tick ${action.tick} (Current: ${tick})`);
                this.currentReplayIndex++;
            } else {
                // Future action
                break;
            }
        }
        return actions;
    }

    public exportLog(): string {
        return JSON.stringify(this.log);
    }

    public importLog(json: string): ReplayLog | null {
        try {
            return JSON.parse(json);
        } catch (e) {
            console.error("[ReplaySystem] Invalid JSON", e);
            return null;
        }
    }

    public getSeed(): string {
        return this.log.seed;
    }
}
