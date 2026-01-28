
import { GameState, Player, Emotion, Bot } from '../../types';
import { THRESHOLDS } from '../../constants';

export const updateEmotion = (p: Player | Bot, dt: number) => {
    if (p.isDead) {
        setEmotion(p, 'ko');
        return;
    }

    // Timers
    if (p.emotionTimer > 0) {
        p.emotionTimer -= dt;
        if (p.emotionTimer <= 0) {
            // Revert to default
            setEmotion(p, 'happy');
        }
    }

    // Priority Overrides

    // 1. Victory/Winning (Player only)
    if ('statusScalars' in p && (p.statusScalars.kingForm || 0) > 0.5) {
        setEmotion(p, 'victory', 0.5);
        return;
    }

    // 2. Despair (Ring 3 + Low Match)
    if ('ring' in p && p.ring === 3 && 'matchPercent' in p && (p as Player).matchPercent < 0.60) {
        setEmotion(p, 'despair', 1.0);
        return;
    }

    // 3. Hungry (Low Mass)
    if (p.radius < 30) {
        // setEmotion(p, 'hungry', 0.5); 
    }
};

export const setEmotion = (p: Player | Bot, emo: Emotion, duration: number = 2.0) => {
    if (p.emotion === emo && p.emotionTimer > 0) {
        p.emotionTimer = Math.max(p.emotionTimer, duration);
        return;
    }

    p.emotion = emo;
    p.emotionTimer = duration;
};

// Hook for events
export const onEat = (p: Player) => setEmotion(p, 'yum', 1.0);
export const onDamage = (p: Player) => setEmotion(p, 'panic', 1.5);
export const onGreed = (p: Player) => setEmotion(p, 'greed', 2.0);
export const triggerEmotion = setEmotion; 
