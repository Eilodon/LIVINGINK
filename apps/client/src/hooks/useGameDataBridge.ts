import { MutableRefObject, useCallback, useRef } from 'react';
import { GameState, Player } from '../types';
import { StatsStore } from '@cjr/engine';

export interface BridgedStats {
  score: number;
  matchPercent: number;
  currentHealth: number;
  maxHealth: number;
}

export const useGameDataBridge = (gameStateRef: MutableRefObject<GameState | null>) => {
  // We use a mutable object to avoid allocations
  const statsRef = useRef<BridgedStats>({
    score: 0,
    matchPercent: 0,
    currentHealth: 0,
    maxHealth: 0,
  });

  const getStats = useCallback((): BridgedStats => {
    const state = gameStateRef.current;
    if (!state || !state.player) return statsRef.current; // Return last known or zeros

    const player = state.player;
    const idx = player.physicsIndex;

    // "The Blind Fix": Read directly from memory if available
    if (idx !== undefined) {
      const base = idx * StatsStore.STRIDE;
      if (base + 3 < StatsStore.data.length) {
        statsRef.current.currentHealth = StatsStore.data[base];
        statsRef.current.maxHealth = StatsStore.data[base + 1];
        statsRef.current.score = StatsStore.data[base + 2];
        statsRef.current.matchPercent = StatsStore.data[base + 3];
      } else {
        // Fallback to Object (Legacy/Sync issues)
        statsRef.current.currentHealth = player.currentHealth;
        statsRef.current.maxHealth = player.maxHealth;
        statsRef.current.score = player.score;
        statsRef.current.matchPercent = player.matchPercent;
      }
    } else {
      // Fallback to Object (Legacy/Sync issues)
      statsRef.current.currentHealth = player.currentHealth;
      statsRef.current.maxHealth = player.maxHealth;
      statsRef.current.score = player.score;
      statsRef.current.matchPercent = player.matchPercent;
    }

    return statsRef.current;
  }, []);

  return { getStats };
};
