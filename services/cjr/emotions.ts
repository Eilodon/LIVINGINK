
import { Player, Bot, Emotion } from '../../types';

export const updateEmotion = (entity: Player | Bot, dt: number) => {
    if (entity.emotionTimer > 0 && entity.emotionOverride) {
        entity.emotionTimer -= dt;
        entity.emotion = entity.emotionOverride;
        if (entity.emotionTimer <= 0) {
            entity.emotionOverride = undefined;
        }
        return;
    }

    // 1. Defeat / Dead
    if (entity.isDead) {
        entity.emotion = 'ko';
        return;
    }

    // 2. Victory (Flag?)
    // if (won) entity.emotion = 'victory';

    // 3. Combat (Recently matched or hit)
    // We need timers. 
    // Simplified State Machine:

    // Recently hit -> panic
    if (entity.lastHitTime < 0.6) {
        entity.emotion = 'panic';
        return;
    }

    // Low Health (< 30%)
    if (entity.currentHealth < entity.maxHealth * 0.3) {
        entity.emotion = 'despair';
        return;
    }

    // Hungry if not eating
    if (entity.lastEatTime > 5.0) {
        entity.emotion = 'hungry';
        return;
    }

    // High Match % (Focused)
    if (entity.matchPercent > 0.8) {
        entity.emotion = 'focus';
        return;
    }

    // Eating (Yum)
    // Need trigger from consumePickup

    // Default
    entity.emotion = 'happy';
};

export const triggerEmotion = (entity: Player | Bot, trigger: 'eat' | 'hit' | 'score') => {
    // Override temporary emotions
    if (trigger === 'eat') entity.emotion = 'yum';
    if (trigger === 'hit') entity.emotion = 'panic';
    if (trigger === 'score') entity.emotion = 'greed';

    entity.emotionOverride = entity.emotion;
    entity.emotionTimer = 0.6;
};
