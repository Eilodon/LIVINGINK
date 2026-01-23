
import { PlayerProfile, TattooId } from '../types';

export const getEmptyProfile = (): PlayerProfile => ({
  gamesPlayed: 0,
  totalKills: 0,
  highScore: 0,
  unlockedSkins: [],
  unlockedTattoos: [],
  lastUpdated: Date.now()
});

export const saveProfile = (profile: PlayerProfile) => {
  localStorage.setItem('cjr_profile', JSON.stringify(profile));
};

export const loadProfile = (): PlayerProfile => {
  const data = localStorage.getItem('cjr_profile');
  if (data) return JSON.parse(data);
  return getEmptyProfile();
};
