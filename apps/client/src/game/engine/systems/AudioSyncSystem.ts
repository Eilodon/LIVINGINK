import { AudioEngine } from '../../audio/AudioEngine';
import { GameState } from '../../../types';
import { TransformStore, defaultWorld } from '@cjr/engine';
const w = defaultWorld;

export class AudioSyncSystem {
    constructor(private audioEngine: AudioEngine) { }

    public update(state: GameState): void {
        let listenerX = state.player.position.x;
        let listenerY = state.player.position.y;

        // Read from DOD Store if available (SSOT)
        if (state.player.physicsIndex !== undefined) {
            const tIdx = state.player.physicsIndex * 8;
            listenerX = w.transform[tIdx];
            listenerY = w.transform[tIdx + 1];
        }

        this.audioEngine.setListenerPosition(listenerX, listenerY);

        // Sync BGM intensity with match percent
        this.audioEngine.setBGMIntensity(Math.floor(state.player.matchPercent * 4));
    }
}
