
import { Player, Bot, Emotion } from '../../types';

export const updateEmotion = (entity: Player | Bot, dt: number) => {
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

    // Low Health (< 30%)
    if (entity.currentHealth < entity.maxHealth * 0.3) {
        entity.emotion = 'despair';
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
    // In a full system we'd manage a priority queue or timer.
    if (trigger === 'eat') entity.emotion = 'yum';
    if (trigger === 'hit') entity.emotion = 'panic';
    if (trigger === 'score') entity.emotion = 'greed';

    // Reset after 0.5s? 
    // This requires stateful timers on Entity again.
    // MVP: Just set it, updateEmotion loop will reset it next frame if conditions persist/don't persist?
    // If updateEmotion runs every frame, it overwrites 'yum' instantly.
    // We should skip updateEmotion if a transient emotion is active?
    // Or add emotionTimer to entity.
};
