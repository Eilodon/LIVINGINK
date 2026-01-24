
import {
  SKILL_COOLDOWN_BASE
} from '../../../constants';
import { Player, Bot, ShapeId, Vector2, GameState } from '../../../types';
import { executeShapeSkill } from '../../cjr/shapeSkills';

/**
 * Skill System - Now delegates to shapeSkills.ts
 * This provides a clean interface for the engine to call
 */
export const applySkill = (
  entity: Player | Bot,
  targetPos?: Vector2,
  state?: GameState
): boolean => {
  if (!state) return false;

  // Delegate to shape-specific skill system
  return executeShapeSkill(entity, state);
};
