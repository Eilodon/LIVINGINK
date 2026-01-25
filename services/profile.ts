
import { PlayerProfile } from '../types';
import { TattooId } from './cjr/cjrTypes';

export const getEmptyProfile = (): PlayerProfile => ({
  gamesPlayed: 0,
  totalKills: 0,
  highScore: 0,
  unlockedSkins: [],
  unlockedTattoos: [],
  cosmetics: {
    ownedSkins: [],
    ownedTrails: [],
    ownedAuras: [],
    ownedBadges: [],
    active: {}
  },
  quests: {
    daily: {},
    weekly: {},
    lastReset: Date.now()
  },
  guildId: null,
  lastUpdated: Date.now()
});

export const saveProfile = (profile: PlayerProfile) => {
  localStorage.setItem('cjr_profile', JSON.stringify(profile));
};

export const loadProfile = (): PlayerProfile => {
  const data = localStorage.getItem('cjr_profile');
  if (data) {
    const parsed = JSON.parse(data) as PlayerProfile;
    return { ...getEmptyProfile(), ...parsed };
  }
  return getEmptyProfile();
};


export const unlockSkin = (skinId: string) => {
  const profile = loadProfile();
  if (!profile.cosmetics.ownedSkins.includes(skinId)) {
    profile.cosmetics.ownedSkins.push(skinId);
    saveProfile(profile);
    console.log(`🎁 Skin Unlocked: ${skinId}`);
  }
};

export const unlockBadge = (badgeId: string) => {
  const profile = loadProfile();
  if (!profile.cosmetics.ownedBadges.includes(badgeId)) {
    profile.cosmetics.ownedBadges.push(badgeId);
    saveProfile(profile);
    console.log(`🏅 Badge Unlocked: ${badgeId}`);
  }
};

export const updateProfileStats = (stats: { kills: number; score: number }) => {
  const profile = loadProfile();
  profile.totalKills += stats.kills;
  profile.highScore = Math.max(profile.highScore, stats.score);
  profile.gamesPlayed += 1;
  saveProfile(profile);
};
