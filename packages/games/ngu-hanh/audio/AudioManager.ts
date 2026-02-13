// Web Audio API implementation
export class AudioManager {
    private static instance: AudioManager;
    private audioContext: AudioContext | null = null;
    private sounds: Map<string, AudioBuffer> = new Map();
    private gainNode: GainNode | null = null;

    constructor() {
        if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                this.gainNode = this.audioContext.createGain();
                this.gainNode.connect(this.audioContext.destination);
                this.gainNode.gain.value = 0.5; // 50% volume
            } catch (e) {
                console.warn('AudioManager: Failed to initialize AudioContext', e);
            }
        }
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    async loadSound(key: string, url: string): Promise<void> {
        if (!this.audioContext) return;
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.sounds.set(key, audioBuffer);
        } catch (error) {
            console.warn(`AudioManager: Failed to load sound ${key} from ${url}`, error);
        }
    }

    playSound(key: string, volume: number = 1.0): void {
        if (!this.audioContext || !this.gainNode) return;

        // Resume context if suspended (browser policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(e => console.warn(e));
        }

        const buffer = this.sounds.get(key);
        if (!buffer) {
            // console.warn(`Sound ${key} not loaded`); // Suppress warning to avoid spam if sound missing
            return;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = buffer;
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.gainNode);

        source.start(0);
    }

    // Element-specific sound playback
    playElementSound(element: number, action: string): void {
        const soundMap: Record<number, Record<string, string>> = {
            1: { match: 'metal_clang', destroy: 'metal_shatter' }, // Metal
            2: { match: 'wood_crack', destroy: 'wood_break' },     // Wood
            3: { match: 'water_drop', destroy: 'water_splash' },   // Water
            4: { match: 'fire_whoosh', destroy: 'fire_burst' },    // Fire
            5: { match: 'earth_rumble', destroy: 'earth_crumble' } // Earth
        };

        const elementSounds = soundMap[element];
        if (elementSounds && elementSounds[action]) {
            this.playSound(elementSounds[action]);
        }
    }
}
