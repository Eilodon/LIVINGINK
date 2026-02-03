export interface LevelConfig {
  id: number;
  name: string;
  thresholds: {
    ring2: number;
    ring3: number;
    win: number;
  };
  winHoldSeconds: number;
  timeLimit: number;
  waveIntervals: {
    ring1: number;
    ring2: number;
    ring3: number;
  };
  burstSizes: {
    ring1: number;
    ring2: number;
    ring3: number;
  };
  spawnWeights: {
    pigment: number;
    neutral: number;
    special: number;
  };
  botCount: number;
  boss: {
    boss1Enabled: boolean;
    boss2Enabled: boolean;
    boss1Time: number;
    boss2Time: number;
    boss1Health: number;
    boss2Health: number;
  };
  pity: {
    stuckThreshold: number;
    duration: number;
    multiplier: number;
  };
  ring3Debuff: {
    enabled: boolean;
    threshold: number;
    duration: number;
    speedMultiplier: number;
  };
  rushWindowDuration: number;
}
