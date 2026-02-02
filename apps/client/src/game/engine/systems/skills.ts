/**
 * Skills System - Stub for skill activation
 * TODO: Implement full skill logic
 */

import type { GameState, Player, Bot } from '../../../types';

/**
 * Apply a skill to an entity
 * Currently a stub - skills are handled by SkillSystem in DOD
 */
export function applySkill(
    _state: GameState,
    _entity: Player | Bot,
    _skillId: number
): void {
    // Stub - actual skill logic is in SkillSystem DOD
    // This is kept for legacy compatibility
}
