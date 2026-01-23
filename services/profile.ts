import { MatchSummary, MutationId, MutationTier, PlayerProfile } from '../types';
import { getAllMutationIds, getMutationIdsByTier } from './mutations';

const PROFILE_STORAGE_KEY = 'gu-king-profile-v1';
const UNLOCK_POINT_STEP = 5;
const GAME_POINT_WEIGHT = 2;

const TIER_REQUIREMENTS: Array<{ tier: MutationTier; kills: number; games: number }> = [
  { tier: MutationTier.Rare, kills: 5, games: 2 },
  { tier: MutationTier.Epic, kills: 15, games: 5 },
  { tier: MutationTier.Legendary, kills: 30, games: 9 },
];

const getDefaultProfile = (): PlayerProfile => ({
  gamesPlayed: 0,
  totalKills: 0,
  highScore: 0,
  unlockedSkins: [],
  unlockedMutations: getMutationIdsByTier(MutationTier.Common),
  lastUpdated: Date.now(),
});

const sanitizeMutationIds = (value: unknown): MutationId[] => {
  if (!Array.isArray(value)) return [];
  const valid = new Set(getAllMutationIds());
  return value.filter((id): id is MutationId => typeof id === 'string' && valid.has(id as MutationId));
};

const ensureBaselineUnlocks = (mutations: MutationId[]): MutationId[] => {
  const baseline = getMutationIdsByTier(MutationTier.Common);
  const set = new Set(mutations);
  baseline.forEach((id) => set.add(id));
  return Array.from(set);
};

const getEligibleTiers = (profile: PlayerProfile): MutationTier[] => {
  const tiers: MutationTier[] = [MutationTier.Common];
  TIER_REQUIREMENTS.forEach((rule) => {
    if (profile.totalKills >= rule.kills || profile.gamesPlayed >= rule.games) {
      tiers.push(rule.tier);
    }
  });
  return tiers;
};

const grantUnlocks = (profile: PlayerProfile): MutationId[] => {
  const unlocked = new Set(ensureBaselineUnlocks(profile.unlockedMutations));
  const progressPoints = profile.totalKills + profile.gamesPlayed * GAME_POINT_WEIGHT;
  const targetUnlockCount = getMutationIdsByTier(MutationTier.Common).length + Math.floor(progressPoints / UNLOCK_POINT_STEP);
  const eligibleTiers = getEligibleTiers(profile);
  const newlyUnlocked: MutationId[] = [];

  while (unlocked.size < targetUnlockCount) {
    const nextTier = eligibleTiers.find((tier) =>
      getMutationIdsByTier(tier).some((id) => !unlocked.has(id))
    );
    if (!nextTier) break;
    const available = getMutationIdsByTier(nextTier).filter((id) => !unlocked.has(id));
    if (!available.length) break;
    const pick = available[Math.floor(Math.random() * available.length)];
    unlocked.add(pick);
    newlyUnlocked.push(pick);
  }

  profile.unlockedMutations = Array.from(unlocked);
  return newlyUnlocked;
};

export const loadProfile = (): PlayerProfile => {
  if (typeof window === 'undefined' || !window.localStorage) return getDefaultProfile();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  } catch {
    return getDefaultProfile();
  }
  if (!raw) return getDefaultProfile();
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const base = getDefaultProfile();
    const unlockedMutations = sanitizeMutationIds(parsed.unlockedMutations);
    return {
      ...base,
      ...parsed,
      gamesPlayed: Math.max(0, parsed.gamesPlayed ?? 0),
      totalKills: Math.max(0, parsed.totalKills ?? 0),
      highScore: Math.max(base.highScore, parsed.highScore ?? 0),
      unlockedMutations: ensureBaselineUnlocks(unlockedMutations.length ? unlockedMutations : base.unlockedMutations),
      lastUpdated: Date.now(),
    };
  } catch {
    return getDefaultProfile();
  }
};

export const saveProfile = (profile: PlayerProfile) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage can be blocked (private mode), skip persistence silently.
  }
};

export const applyMatchResult = (
  profile: PlayerProfile,
  summary: MatchSummary
): { profile: PlayerProfile; newlyUnlocked: MutationId[] } => {
  const next: PlayerProfile = {
    ...profile,
    gamesPlayed: profile.gamesPlayed + 1,
    totalKills: profile.totalKills + summary.kills,
    highScore: Math.max(profile.highScore, summary.score),
    lastUpdated: Date.now(),
  };

  const newlyUnlocked = grantUnlocks(next);
  return { profile: next, newlyUnlocked };
};
