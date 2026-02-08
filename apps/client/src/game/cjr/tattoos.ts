/**
 * @cjr/client - Tattoos (Facade Layer)
 *
 * EIDOLON-V P2 FIX: Re-export from engine package (Single Source of Truth).
 * Client-specific VFX wrappers are handled via eventBuffer bridge.
 *
 * @deprecated Direct definitions in this file are deprecated.
 *             Use `import { ... } from '@cjr/engine/modules/cjr'` for pure logic.
 *             This file provides client-specific adapters only.
 */

// =============================================================================
// RE-EXPORT FROM ENGINE (SSOT)
// =============================================================================
export type {
  TattooDefinition,
  ITattooEntity,
  ITattooFood,
  TattooChoice,
} from '@cjr/engine/modules/cjr';

export {
  TattooFlag,
  StatusFlag,
  getTattooById,
  getTattooChoices,
  getAllTattoos,
  triggerTattooOnSkill,
  triggerTattooOnHit,
  triggerTattooOnConsume,
  triggerTattooOnUpdate,
} from '@cjr/engine/modules/cjr';

import { TattooId } from './cjrTypes';
import type { Player, GameState } from '@/types';
import type { ITattooEntity } from '@cjr/engine/modules/cjr';
import { vfxIntegrationManager } from '../vfx/vfxIntegration';
import { applyTattoo as engineApplyTattoo } from '@cjr/engine/modules/cjr';

// =============================================================================
// CLIENT-SPECIFIC ADAPTER (Adds VFX layer on top of engine logic)
// =============================================================================

/**
 * Client-specific applyTattoo with VFX integration.
 * Engine's applyTattoo emits events; this wrapper also triggers direct VFX.
 *
 * @param player - The player entity (OOP object)
 * @param id - TattooId to apply
 * @param state - GameState for VFX context
 * @returns true if tattoo was applied
 */
export const applyTattoo = (player: Player, id: TattooId, state?: GameState): boolean => {
  // Call engine's pure logic (emits TATTOO_ACTIVATE event)
  // Cast Player to ITattooEntity - they're compatible via duck typing
  const applied = engineApplyTattoo(player as unknown as ITattooEntity, id);

  // Client-specific: Direct VFX call (redundant with eventBuffer, but safe)
  if (applied && state) {
    vfxIntegrationManager.handleTattooActivation(player, id, state);
  }

  return applied;
};

// =============================================================================
// DEPRECATED LEGACY EXPORTS (for backward compatibility)
// =============================================================================

import { MutationTier } from '@/types';

/**
 * @deprecated Use getTattooById from '@cjr/engine/modules/cjr' instead.
 * This type alias is kept for backward compatibility.
 */
export type { MutationTier };
