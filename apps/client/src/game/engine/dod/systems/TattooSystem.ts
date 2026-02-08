// EIDOLON-V FIX: Import from engine SSOT instead of local duplicates
import { TattooAccess, StatsAccess } from '@cjr/engine';
import { getWorld } from '@/game/engine/context';
import { MAX_ENTITIES, EntityFlags } from '@cjr/engine';
import { TattooFlag } from '@/game/engine/statusFlags';

export class TattooSystem {
  static update(dt: number) {
    const w = getWorld();
    const count = MAX_ENTITIES;
    const flags = w.stateFlags;
    const tData = w.tattoo;

    for (let id = 0; id < count; id++) {
      if ((flags[id] & EntityFlags.ACTIVE) === 0) continue;

      const tf = TattooAccess.getFlags(w, id);
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
      const idx = id * 4; // TattooStore uses STRIDE=4
      // Example active effect timer logic
    }
  }

  // Event Hooks (called from Engine/Combat)
  static onHit(attackerId: number, victimId: number) {
    const w = getWorld();
    // Direct Bitmask Check - FAST
    const attFlags = TattooAccess.getFlags(w, attackerId);
    const vicFlags = TattooAccess.getFlags(w, victimId);

    // Pigment Bomb
    if (vicFlags & TattooFlag.PIGMENT_BOMB_ACTIVE) {
      // ... Logic
    }

    // Ink Leech (Attacker)
    // Check Lifesteal in StatsStore or Flags?
  }
}
