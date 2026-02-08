import { AudioEngine } from '@/game/audio/AudioEngine';
import { GameState } from '@/types';
import { TransformAccess } from '@cjr/engine';
import { getWorld } from '../context';

export class AudioSyncSystem {
    constructor(private audioEngine: AudioEngine) { }

    public update(state: GameState): void {
        let listenerX = state.player.position.x;
        let listenerY = state.player.position.y;

        // Read from DOD Store if available (SSOT)
        if (state.player.physicsIndex !== undefined) {
            const w = getWorld();
            const tIdx = state.player.physicsIndex * 8;
            listenerX = w.transform[tIdx];
            listenerY = w.transform[tIdx + 1];
        }

        this.audioEngine.setListenerPosition(listenerX, listenerY);

        // Sync BGM intensity with match percent
        this.audioEngine.setBGMIntensity(Math.floor(state.player.matchPercent * 4));
    }
}
