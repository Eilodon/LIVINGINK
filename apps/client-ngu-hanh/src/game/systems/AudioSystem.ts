
export class AudioSystem {
    private ctx: AudioContext;
    private enabled: boolean = true;

    constructor() {
        // Initialize AudioContext
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
    }

    public playSound(name: string, volume: number = 0.5) {
        if (!this.enabled || this.ctx.state === 'suspended') {
            this.ctx.resume().catch(e => console.warn(e));
        }

        switch (name) {
            case 'match':
                this.playMatchSound(volume);
                break;
            case 'swap_fail':
                this.playSwapFailSound(volume);
                break;
            case 'boss_skill':
                this.playBossSkillSound(volume);
                break;
            case 'victory':
                this.playVictorySound(volume);
                break;
            default:
                // Generic interaction sound
                this.playTone(440, 0.1, 'sine', volume);
                break;
        }
    }

    // --- Procedural Sound Generators ---

    private playTone(freq: number, duration: number, type: OscillatorType, vol: number) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    private playMatchSound(vol: number) {
        // High pitch pleasant chime (Pentatonic)
        this.playTone(523.25, 0.2, 'sine', vol); // C5
        setTimeout(() => this.playTone(659.25, 0.2, 'sine', vol), 50); // E5
        setTimeout(() => this.playTone(783.99, 0.3, 'sine', vol), 100); // G5
    }

    private playSwapFailSound(vol: number) {
        // Low pitch error buzz
        this.playTone(150, 0.2, 'sawtooth', vol * 0.5);
    }

    private playBossSkillSound(vol: number) {
        // Ominous low drone/rumble
        this.playTone(110, 0.5, 'square', vol * 0.4);
        this.playTone(55, 0.5, 'sawtooth', vol * 0.4);
    }

    private playVictorySound(vol: number) {
        // Victory fanfare
        const now = this.ctx.currentTime;
        const melody = [523.25, 659.25, 783.99, 1046.50]; // C Major Arpeggio
        melody.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.4, 'triangle', vol), i * 150);
        });
    }
}
