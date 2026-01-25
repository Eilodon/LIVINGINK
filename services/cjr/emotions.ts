import { Emotion, CJRPlayerState } from './cjrTypes';

/**
 * Updates the emotion state based on recent events and current stats.
 */
/**
 * Updates the emotion state based on recent events and current stats.
 */
export function updateEmotion(entity: any, dt: number) {
    // Check overrides
    if (entity.emotionTimer > 0) {
        entity.emotionTimer -= dt;
        if (entity.emotionOverride) {
            entity.emotion = entity.emotionOverride;
            if (entity.emotionTimer <= 0) {
                entity.emotionOverride = undefined;
            } else {
                return;
            }
        }
    }

    // Default Update
    const healthP = (entity.currentHealth || 1) / (entity.maxHealth || 1);
    const mass = entity.radius || 10; // proxy for mass
    const match = entity.matchPercent || 0;

    // We don't have an "Event" here, so we pass 'idle' or similar.
    // Real events (damage, eat) should trigger transient overrides via triggerEmotion.
    entity.emotion = calculateEmotion(entity.emotion, 'idle', healthP, mass, match, dt);
}

function calculateEmotion(
    currentEmotion: Emotion,
    event: 'eat' | 'damage' | 'idle' | 'kill' | 'enter_ring' | 'win_start',
    healthPercent: number,
    mass: number,
    matchPercent: number,
    dt: number
): Emotion {
    // 1. High Priority Overrides
    if (healthPercent < 0.2) return 'panic';
    if (event === 'win_start') return 'victory';
    if (event === 'kill') return 'yum'; // or 'greed'

    // 2. Transient Events (Timer based elsewhere, but logic here)
    if (event === 'eat') return 'yum';
    if (event === 'damage') return 'panic';
    if (event === 'enter_ring') return 'focus';

    // 3. Steady States
    if (currentEmotion === 'yum' || currentEmotion === 'panic') {
        // These should decay back to steady state after timer in the loop
        // But if we are called every tick, we might need a timer passed in.
        // For now, assuming this function is called on Event Trigger or periodically check steady state.
        // If "idle", check conditions:
    }

    // Steady State Logic
    if (matchPercent < 0.5 && mass > 50) return 'despair'; // Big but wrong color
    if (matchPercent > 0.9) return 'happy';

    if (mass < 20) return 'hungry';

    return 'happy'; // Default
}

/**
 * Returns the duration (ms) for a transient emotion.
 */
export function getEmotionDuration(emotion: Emotion): number {
    switch (emotion) {
        case 'yum': return 1000;
        case 'panic': return 1500;
        case 'victory': return 99999;
        case 'focus': return 2000;
        case 'ko': return 99999;
        default: return 0; // Steady state
    }
}

/**
 * Triggers a transient emotion override.
 */
export function triggerEmotion(entity: any, emotion: Emotion) {
    // Priority check could go here
    const dur = getEmotionDuration(emotion);
    if (dur > 0) {
        entity.emotionOverride = emotion;
        entity.emotionTimer = dur / 1000; // stored in seconds usually? checking GameRoom updates
        // GameRoom uses dt in seconds.
        // Let's assume dt is seconds. so dur is ms.
        // wait, updateEmotion takes dt.
        // entity structure has emotionTimer.
    }
}
