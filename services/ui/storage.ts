export type Settings = {
  version: 1;
  usePixi: boolean;
};

export type Progression = {
  version: 1;
  unlockedLevel: number;
  tutorialSeen: boolean;
};

const SETTINGS_KEY = 'cjr:settings:v1';
const PROGRESSION_KEY = 'cjr:progression:v1';

export const defaultSettings: Settings = {
  version: 1,
  usePixi: true,
};

export const defaultProgression: Progression = {
  version: 1,
  unlockedLevel: 1,
  tutorialSeen: false,
};

const safeJsonParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const loadSettings = (): Settings => {
  const parsed = safeJsonParse<Settings>(localStorage.getItem(SETTINGS_KEY));
  if (!parsed || parsed.version !== 1) return defaultSettings;
  return { ...defaultSettings, ...parsed };
};

export const saveSettings = (settings: Settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const loadProgression = (): Progression => {
  const parsed = safeJsonParse<Progression>(localStorage.getItem(PROGRESSION_KEY));
  if (!parsed || parsed.version !== 1) return defaultProgression;
  return { ...defaultProgression, ...parsed };
};

export const saveProgression = (progression: Progression) => {
  localStorage.setItem(PROGRESSION_KEY, JSON.stringify(progression));
};
