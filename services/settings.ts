export type QualityMode = 'auto' | 'high' | 'medium' | 'low';

export type GameSettings = {
  qualityMode: QualityMode;
  debugOverlay: boolean;
  showParticles: boolean;
  showParticleLines: boolean;
  showFloatingTexts: boolean;
};

const STORAGE_KEY = 'color-jelly-rush-settings-v1';

const DEFAULT_SETTINGS: GameSettings = {
  qualityMode: 'auto',
  debugOverlay: false,
  showParticles: true,
  showParticleLines: true,
  showFloatingTexts: true,
};

const listeners = new Set<() => void>();

const loadFromStorage = (): GameSettings => {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const qualityMode: QualityMode =
      parsed.qualityMode === 'auto' || parsed.qualityMode === 'high' || parsed.qualityMode === 'medium' || parsed.qualityMode === 'low'
        ? parsed.qualityMode
        : DEFAULT_SETTINGS.qualityMode;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      qualityMode,
      debugOverlay: Boolean(parsed.debugOverlay),
      showParticles: parsed.showParticles !== false,
      showParticleLines: parsed.showParticleLines !== false,
      showFloatingTexts: parsed.showFloatingTexts !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

let currentSettings: GameSettings = loadFromStorage();

const persist = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch {
    // ignore
  }
};

export const getSettings = (): GameSettings => currentSettings;

export const setSettings = (next: Partial<GameSettings>) => {
  currentSettings = { ...currentSettings, ...next };
  persist();
  listeners.forEach((listener) => listener());
};

export const resetSettings = () => {
  currentSettings = { ...DEFAULT_SETTINGS };
  persist();
  listeners.forEach((listener) => listener());
};

export const subscribeSettings = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
