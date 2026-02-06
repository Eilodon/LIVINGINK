// EIDOLON-V FIX: Import from engine SSOT instead of local duplicates
import { TattooStore, StatsStore, StateStore, defaultWorld } from '@cjr/engine';
import { MAX_ENTITIES, EntityFlags } from '@cjr/engine';
import { TattooFlag } from '../../statusFlags';
const w = defaultWorld;

export class TattooSystem {
  static update(dt: number) {
    const count = MAX_ENTITIES;
    const flags = w.stateFlags;
    const tFlags = TattooStore.flags;
    const tData = TattooStore.data;

    for (let id = 0; id < count; id++) {
      if ((flags[id] & EntityFlags.ACTIVE) === 0) continue;

      const tf = tFlags[id];
      if (tf === 0) continue;

      // 1. Passive Checks (e.g. Deposit Shield)
      // if (tf & TattooFlag.CORE_SHIELD_BONUS) {
      // Logic requires checking Ring/Match.
      // That data is in StatsStore now!
      // const sIdx = id * StatsStore.STRIDE;
      // const match = StatsStore.data[sIdx + 3];
      // if (match > 0.8) { ... }
      // }

      // 2. Timers
      const idx = id * TattooStore.STRIDE;
      // Example active effect timer logic
    }
  }

  // Event Hooks (called from Engine/Combat)
  static onHit(attackerId: number, victimId: number) {
    // Direct Bitmask Check - FAST
    const attFlags = TattooStore.flags[attackerId];
    const vicFlags = TattooStore.flags[victimId];

    // Pigment Bomb
    if (vicFlags & TattooFlag.PIGMENT_BOMB_ACTIVE) {
      // ... Logic
    }

    // Ink Leech (Attacker)
    // Check Lifesteal in StatsStore or Flags?
  }
}
