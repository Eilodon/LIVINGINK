import { z } from "zod";

export const MoveSchema = z.object({
    x1: z.number().int().min(0),
    y1: z.number().int().min(0),
    x2: z.number().int().min(0),
    y2: z.number().int().min(0)
});

export const PurchaseSchema = z.object({
    itemId: z.string().min(1)
});

export const ClaimRewardSchema = z.object({
    seasonId: z.string().optional(),
    level: z.number().int().min(1),
    track: z.enum(['FREE', 'PREMIUM'])
});

export const CheatSchema = z.object({
    type: z.enum(['gold', 'gems']),
    amount: z.number().int()
});

export const PayloadSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("move"), data: MoveSchema }),
    z.object({ type: z.literal("purchase"), data: PurchaseSchema }),
    z.object({ type: z.literal("claim_reward"), data: ClaimRewardSchema }),
    z.object({ type: z.literal("cheat"), data: CheatSchema })
]);

export const LevelCompleteSchema = z.object({
    score: z.number().int().min(0),
    checksum: z.number().int()
});

