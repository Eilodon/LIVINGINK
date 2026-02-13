// Haptic feedback for mobile devices
export class HapticManager {
    private static instance: HapticManager;
    private isSupported: boolean = false;

    constructor() {
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            this.isSupported = 'vibrate' in navigator ||
                'hapticFeedback' in navigator ||
                !!(window as any).TapticEngine;
        }
    }

    public static getInstance(): HapticManager {
        if (!HapticManager.instance) {
            HapticManager.instance = new HapticManager();
        }
        return HapticManager.instance;
    }

    // Element-specific haptic patterns
    trigger(pattern: string): void {
        if (!this.isSupported) return;

        const patterns: Record<string, number[]> = {
            'metal_clang': [50],                    // Sharp tap
            'wood_crack': [100, 50, 100],          // Double thud
            'water_drop': [30, 20, 30, 20, 30],   // Ripple effect
            'fire_burst': [20, 20, 20, 20, 20],   // Rapid pulses
            'earth_rumble': [200],                 // Heavy vibration

            'match_success': [50, 100, 50],       // Success pattern
            'cycle_complete': [100, 50, 100, 50, 200], // Avatar State
            'boss_damage': [150, 50, 150]         // Impact
        };

        const hapticPattern = patterns[pattern];
        if (hapticPattern) {
            this.vibrate(hapticPattern);
        }
    }

    private vibrate(pattern: number[]): void {
        if (typeof navigator === 'undefined') return;

        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        } else if ((window as any).TapticEngine) {
            // iOS Taptic Engine workaround (simplification)
            (window as any).TapticEngine.impact({ style: 'medium' });
        }
    }

    // Wu Xing element haptics
    elementHaptic(element: number): void {
        const elementPatterns: Record<number, string> = {
            1: 'metal_clang',   // Metal: Sharp
            2: 'wood_crack',    // Wood: Organic
            3: 'water_drop',    // Water: Flowing
            4: 'fire_burst',    // Fire: Energetic
            5: 'earth_rumble'   // Earth: Heavy
        };

        this.trigger(elementPatterns[element] || 'match_success');
    }
}
