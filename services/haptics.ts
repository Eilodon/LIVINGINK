// EIDOLON-V: Haptic Feedback Service
// Provides vibration feedback on supported devices

type HapticPattern = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error';

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  selection: 15,
  success: [20, 50, 20],
  error: [50, 30, 50, 30, 50],
};

export const triggerHaptic = (pattern: HapticPattern = 'light'): void => {
  if (!navigator.vibrate) return;

  try {
    navigator.vibrate(patterns[pattern] || 10);
  } catch (e) {
    // Silently fail - haptics are non-critical
  }
};

export const isHapticsSupported = (): boolean => {
  return 'vibrate' in navigator;
};
