import { z } from 'zod';

export const LevelConfigSchema = z.object({
  id: z.number().min(1).max(100),
  name: z.string().min(1).max(50),
  thresholds: z.object({
    ring2: z.number().min(0).max(1),
    ring3: z.number().min(0).max(1),
    win: z.number().min(0).max(1),
  }).refine(t => t.ring2 < t.ring3 && t.ring3 < t.win, {
    message: 'Thresholds must be: ring2 < ring3 < win'
  }),
  winHoldSeconds: z.number().min(0.5).max(10),
  timeLimit: z.number().min(30).max(600),
  waveIntervals: z.object({
    ring1: z.number().min(0.1).max(60),
    ring2: z.number().min(0.1).max(60),
    ring3: z.number().min(0.1).max(60),
  }),
  burstSizes: z.object({
    ring1: z.number().min(1).max(50),
    ring2: z.number().min(1).max(50),
    ring3: z.number().min(1).max(50),
  }),
  spawnWeights: z.object({
    pigment: z.number().min(0).max(1),
    neutral: z.number().min(0).max(1),
    special: z.number().min(0).max(1),
  }).refine(w => Math.abs(w.pigment + w.neutral + w.special - 1) < 0.01, {
    message: 'Spawn weights must sum to 1'
  }),
  botCount: z.number().min(0).max(50),
  boss: z.object({
    boss1Enabled: z.boolean(),
    boss2Enabled: z.boolean(),
    boss1Time: z.number().min(0).max(600),
    boss2Time: z.number().min(0).max(600),
    boss1Health: z.number().min(1).max(10000),
    boss2Health: z.number().min(1).max(10000),
  }),
  pity: z.object({
    stuckThreshold: z.number().min(1).max(60),
    duration: z.number().min(1).max(30),
    multiplier: z.number().min(1).max(5),
  }),
  ring3Debuff: z.object({
    enabled: z.boolean(),
    threshold: z.number().min(0).max(1),
    duration: z.number().min(0.5).max(10),
    speedMultiplier: z.number().min(0.1).max(2),
  }),
  rushWindowDuration: z.number().min(1).max(30),
});

export type LevelConfig = z.infer<typeof LevelConfigSchema>;

export function validateLevelConfig(data: unknown): { success: boolean; errors: string[]; data?: LevelConfig } {
  const result = LevelConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, errors: [], data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
  };
}
