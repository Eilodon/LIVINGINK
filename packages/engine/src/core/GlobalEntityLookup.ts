/**
 * @cjr/engine - Global Entity Lookup
 *
 * Replacement for the deprecated EntityLookup from compat.ts.
 * Used by legacy client code to map DOD indices back to JS objects.
 */

import { MAX_ENTITIES } from '../generated/WorldState.js';

/**
 * Global entity lookup array.
 * Maps physicsIndex -> Entity Object.
 */
export const EntityLookup: any[] = new Array(MAX_ENTITIES).fill(null);
