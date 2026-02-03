/**
 * @eidolon/engine - CJR State Interfaces
 *
 * CJR-specific state interfaces that extend the base engine interfaces.
 * These add color matching, ring progression, and tattoo mechanics.
 */

import type { IEnginePlayer, IEngineBot, IColorVec3 } from '../../interfaces/IGameState';
import type { PigmentVec3 } from './types';

/**
 * CJR Player - extends base with color matching mechanics
 */
export interface ICJRPlayer extends IEnginePlayer {
    // Color matching
    matchPercent: number;
    setMatchPercent(percent: number): void;

    // Pigment (current color)
    pigment: PigmentVec3;
    setPigment(r: number, g: number, b: number): void;

    // Target color to match
    targetPigment: PigmentVec3;

    // Ring progression (1=outer, 2=mid, 3=inner)
    ring: 1 | 2 | 3;
    setRing(ring: 1 | 2 | 3): void;

    // Tattoo/mutation flags
    tattooFlags?: number;
    setTattooFlags?(flags: number): void;
}

/**
 * CJR Bot - extends base with color and personality
 */
export interface ICJRBot extends IEngineBot {
    personality: string;

    // Bot color
    pigment: PigmentVec3;
    setPigment(r: number, g: number, b: number): void;

    // AI behavior state
    aiState?: 'wander' | 'hunt' | 'flee' | 'feed';
}

/**
 * Type guard to check if player is CJR player
 */
export function isCJRPlayer(player: IEnginePlayer): player is ICJRPlayer {
    return 'pigment' in player && 'ring' in player;
}

/**
 * Type guard to check if bot is CJR bot
 */
export function isCJRBot(bot: IEngineBot): bot is ICJRBot {
    return 'pigment' in bot && 'personality' in bot;
}
