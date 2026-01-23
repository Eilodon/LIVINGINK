type HapticType = 'light' | 'medium' | 'heavy';

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: [20, 10, 20],
};

let lastHapticAt = 0;
const HAPTIC_COOLDOWN_MS = 90;

export const triggerHaptic = (type: HapticType) => {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastHapticAt < HAPTIC_COOLDOWN_MS) return;
  lastHapticAt = now;
  navigator.vibrate(HAPTIC_PATTERNS[type]);
};
