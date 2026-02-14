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

export const PayloadSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("move"), data: MoveSchema }),
    z.object({ type: z.literal("purchase"), data: PurchaseSchema }),
    // Add more action types here
]);
