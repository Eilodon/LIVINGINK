
import {
    MAX_SPEED_BASE,
    MAX_ENTITY_RADIUS,
} from '../../../constants';
import { Player, Bot, SizeTier } from '../../../types';

// Logic ported from legacy physics.ts
export const applyGrowth = (entity: Player | Bot, amount: number) => {
    const currentArea = Math.PI * entity.radius * entity.radius;
    const newArea = currentArea + amount * 25;
    entity.radius = Math.sqrt(newArea / Math.PI);
    if (entity.radius > MAX_ENTITY_RADIUS) entity.radius = MAX_ENTITY_RADIUS;

    // Update Tier check
    updateTier(entity);
};

export const updateTier = (entity: Player | Bot) => {
    const r = entity.radius;
    if (r < 40) entity.tier = SizeTier.Larva;
    else if (r < 70) entity.tier = SizeTier.Juvenile;
    else if (r < 100) entity.tier = SizeTier.Adult;
    else if (r < 130) entity.tier = SizeTier.Elder;
    else entity.tier = SizeTier.AncientKing;
};
