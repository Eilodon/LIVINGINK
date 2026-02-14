export class AudioManager {
    private static instance: AudioManager;
    private audioContext: AudioContext | null = null;
    private sounds: Map<string, AudioBuffer> = new Map();
    private masterGain: GainNode | null = null;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;

    // Music Layers
    private musicSources: AudioBufferSourceNode[] = [];
    private musicGains: GainNode[] = [];
    private musicBuffers: AudioBuffer[] = [];
    private isMusicPlaying: boolean = false;

    constructor() {
        if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                this.masterGain = this.audioContext.createGain();

                // Analyser
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 1024;
                this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

                this.masterGain.connect(this.analyser);
                this.analyser.connect(this.audioContext.destination);

                this.masterGain.gain.value = 0.5; // Master Volume
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

    public async resume() {
        if (this.audioContext?.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    public async loadSound(key: string, url: string): Promise<void> {
        if (!this.audioContext) return;
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.sounds.set(key, audioBuffer);
        } catch (error) {
            console.warn(`AudioManager: Failed to load sound ${key}`, error);
        }
    }

    public playSound(key: string, volume: number = 1.0, pitch: number = 1.0): void {
        if (!this.audioContext || !this.masterGain) return;
        this.resume();

        const buffer = this.sounds.get(key);
        if (!buffer) return;

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = buffer;
        source.playbackRate.value = pitch;
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.masterGain);

        source.start(0);
    }

    // --- Adaptive Music System ---

    public async loadMusicLayers(urls: string[]): Promise<void> {
        if (!this.audioContext) return;
        this.musicBuffers = [];

        await Promise.all(urls.map(async (url, index) => {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
                this.musicBuffers[index] = audioBuffer;
            } catch (e) {
                console.error(`Failed to load music layer ${index}: ${url}`, e);
            }
        }));
    }

    public startMusic(): void {
        if (!this.audioContext || this.musicBuffers.length === 0 || this.isMusicPlaying) return;
        this.resume();

        const now = this.audioContext.currentTime + 0.1; // Schedule slightly in future

        this.musicSources = [];
        this.musicGains = [];
        this.isMusicPlaying = true;

        this.musicBuffers.forEach((buffer, index) => {
            const source = this.audioContext!.createBufferSource();
            const gain = this.audioContext!.createGain();

            source.buffer = buffer;
            source.loop = true;

            // Connect
            source.connect(gain);
            gain.connect(this.masterGain!);

            // Initial Volumes: Layer 0 = 100%, others 0%
            gain.gain.setValueAtTime(index === 0 ? 1.0 : 0.0, 0);

            source.start(now);

            this.musicSources.push(source);
            this.musicGains.push(gain);
        });
    }

    public stopMusic(): void {
        this.musicSources.forEach(s => s.stop());
        this.musicSources = [];
        this.musicGains = [];
        this.isMusicPlaying = false;
    }

    public setMusicIntensity(intensity: number): void {
        if (!this.audioContext || this.musicGains.length === 0) return;

        const now = this.audioContext.currentTime;
        const rampTime = 2.0; // 2 seconds fade

        // Layer 0
        this.musicGains[0].gain.setTargetAtTime(1.0, now, 0.5);

        // Layer 1
        let target1 = 0;
        if (intensity > 0.1) target1 = Math.min(1.0, (intensity - 0.1) * 2.5); // 0.1->0.5 maps to 0->1
        this.musicGains[1]?.gain.setTargetAtTime(target1, now, rampTime);

        // Layer 2
        let target2 = 0;
        if (intensity > 0.5) target2 = Math.min(1.0, (intensity - 0.5) * 2.0); // 0.5->1.0 maps to 0->1
        this.musicGains[2]?.gain.setTargetAtTime(target2, now, rampTime);
    }

    public getBassEnergy(): number {
        if (!this.analyser || !this.dataArray) return 0;
        this.analyser.getByteFrequencyData(this.dataArray as any);

        // Sum low bins (0-3: ~0-120Hz)
        let sum = 0;
        for (let i = 0; i < 4; i++) {
            sum += this.dataArray[i];
        }
        return (sum / 4) / 255.0; // Normalized 0-1
    }

    // Element-specific sound playback
    public playElementSound(element: number, action: string): void {
        const soundMap: Record<number, Record<string, string>> = {
            1: { match: 'metal_clang', destroy: 'metal_shatter' },
            2: { match: 'wood_crack', destroy: 'wood_break' },
            3: { match: 'water_drop', destroy: 'water_splash' },
            4: { match: 'fire_whoosh', destroy: 'fire_burst' },
            5: { match: 'earth_rumble', destroy: 'earth_crumble' }
        };

        const elementSounds = soundMap[element];
        if (elementSounds && elementSounds[action]) {
            // Pitch variation for variety
            const pitch = 0.9 + Math.random() * 0.2;
            this.playSound(elementSounds[action], 0.8, pitch);
        }
    }
}

export const audioManager = AudioManager.getInstance();
