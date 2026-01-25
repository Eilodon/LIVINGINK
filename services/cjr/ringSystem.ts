
import { distance } from '../engine/math';
import { GameState, Player, Bot } from '../../types';
import { RING_RADII, THRESHOLDS, COMMIT_BUFFS } from './cjrConstants';

/**
 * Determines which ring a position falls into physically.
 * Ring 1 (Outer) -> Ring 2 (Mid) -> Ring 3 (Inner)
 */
export const getRingAtPosition = (x: number, y: number): 1 | 2 | 3 => {
    const dist = Math.hypot(x, y);
    if (dist <= RING_RADII.R3) return 3;
    if (dist <= RING_RADII.R2) return 2;
    return 1;
};

/**
 * Main update function called by engine/index.ts
 */
export const updateRingLogic = (entity: Player | Bot, dt: number, levelConfig: any, state: GameState) => {
    if (entity.isDead) return;

    // Only players commit? Or bots too? 
    // For MVP, lets enforce ring logic on everyone but maybe bots cheat?
    // Let's enforce for Player types mainly to avoid bots stuck if AI is dumb.
    // But bots should also follow rules.
    if ('matchPercent' in entity) {
        checkRingTransition(entity as Player);
    }
};

/**
 * Checks if a player should transition to a deeper ring.
 * Enforces one-way commit logic.
 */
export const checkRingTransition = (player: Player) => {
    const dist = Math.hypot(player.position.x, player.position.y);

    // Transition Logic: Ring 1 -> Ring 2
    if (player.ring === 1) {
        // Physical entry check
        if (dist < RING_RADII.R2) {
            // Condition check
            if (player.matchPercent >= THRESHOLDS.ENTER_RING2) {
                // COMMIT!
                player.ring = 2;
                applyCommitBuff(player, COMMIT_BUFFS.R2);
            } else {
                // REJECT! Bounce back
                bounceBack(player, RING_RADII.R2);
            }
        }
    }

    // Transition Logic: Ring 2 -> Ring 3
    else if (player.ring === 2) {
        if (dist < RING_RADII.R3) {
            // Condition check
            // Optional: specific Boss logic override here if we want boss death to gate R3
            if (player.matchPercent >= THRESHOLDS.ENTER_RING3) {
                // COMMIT!
                player.ring = 3;
                applyCommitBuff(player, COMMIT_BUFFS.R3);
            } else {
                // REJECT!
                bounceBack(player, RING_RADII.R3);
            }
        }
        // Backward check: keep them in R2 (Inner bound is R3, Outer bound is R2)
        // "Commit 1-way" means once in Ring 2, cannot go back to Ring 1 (R > R2).
        else if (dist > RING_RADII.R2) {
            // Pull back in
            clampToRingOuter(player, RING_RADII.R2);
        }
    }

    // Transition Logic: Ring 3
    else if (player.ring === 3) {
        // Cannot leave R3
        if (dist > RING_RADII.R3) {
            clampToRingOuter(player, RING_RADII.R3);
        }
    }
};

const applyCommitBuff = (player: Player, buff: any) => {
    player.statusEffects.commitShield = buff.shield;
    player.statusEffects.speedBoost = Math.max(player.statusEffects.speedBoost, buff.speed);
    player.statusEffects.tempSpeedTimer = buff.duration;
};

const bounceBack = (player: Player, radiusLimit: number) => {
    const angle = Math.atan2(player.position.y, player.position.x);
    const safeR = radiusLimit + 50;

    player.position.x = Math.cos(angle) * safeR;
    player.position.y = Math.sin(angle) * safeR;

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const dot = player.velocity.x * dx + player.velocity.y * dy;
    if (dot < 0) {
        player.velocity.x -= dot * dx * 1.5;
        player.velocity.y -= dot * dy * 1.5;
    }
};

const clampToRingOuter = (player: Player, radiusLimit: number) => {
    const angle = Math.atan2(player.position.y, player.position.x);
    const safeR = radiusLimit - 10;

    player.position.x = Math.cos(angle) * safeR;
    player.position.y = Math.sin(angle) * safeR;
};
