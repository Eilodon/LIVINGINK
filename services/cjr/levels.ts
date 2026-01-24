export type LevelConfig = {
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
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const tutorialLevels: LevelConfig[] = [
    {
        id: 1,
        name: 'Tutorial I',
        thresholds: { ring2: 0.4, ring3: 0.6, win: 0.85 },
        winHoldSeconds: 1.0,
        timeLimit: 180,
        waveIntervals: { ring1: 7.6, ring2: 9.8, ring3: 12.8 },
        burstSizes: { ring1: 10, ring2: 7, ring3: 4 },
        spawnWeights: { pigment: 0.75, neutral: 0.22, special: 0.03 },
        botCount: 3,
        boss: { boss1Enabled: false, boss2Enabled: false, boss1Time: 80, boss2Time: 140, boss1Health: 320, boss2Health: 500 },
        pity: { stuckThreshold: 7, duration: 4, multiplier: 1.75 },
        ring3Debuff: { enabled: false, threshold: 0.7, duration: 2, speedMultiplier: 0.98 },
        rushWindowDuration: 5,
    },
    {
        id: 2,
        name: 'Tutorial II',
        thresholds: { ring2: 0.45, ring3: 0.65, win: 0.87 },
        winHoldSeconds: 1.1,
        timeLimit: 170,
        waveIntervals: { ring1: 7.9, ring2: 10, ring3: 13.2 },
        burstSizes: { ring1: 9, ring2: 6, ring3: 4 },
        spawnWeights: { pigment: 0.7, neutral: 0.25, special: 0.05 },
        botCount: 4,
        boss: { boss1Enabled: false, boss2Enabled: false, boss1Time: 80, boss2Time: 140, boss1Health: 360, boss2Health: 540 },
        pity: { stuckThreshold: 8, duration: 4, multiplier: 1.65 },
        ring3Debuff: { enabled: false, threshold: 0.7, duration: 2, speedMultiplier: 0.98 },
        rushWindowDuration: 5,
    },
    {
        id: 3,
        name: 'Tutorial III',
        thresholds: { ring2: 0.5, ring3: 0.7, win: 0.88 },
        winHoldSeconds: 1.2,
        timeLimit: 160,
        waveIntervals: { ring1: 8.2, ring2: 10.3, ring3: 13.5 },
        burstSizes: { ring1: 9, ring2: 6, ring3: 4 },
        spawnWeights: { pigment: 0.67, neutral: 0.25, special: 0.08 },
        botCount: 6,
        boss: { boss1Enabled: false, boss2Enabled: false, boss1Time: 75, boss2Time: 135, boss1Health: 400, boss2Health: 600 },
        pity: { stuckThreshold: 9, duration: 4, multiplier: 1.55 },
        ring3Debuff: { enabled: false, threshold: 0.7, duration: 2, speedMultiplier: 0.98 },
        rushWindowDuration: 5,
    },
    {
        id: 4,
        name: 'Intro Boss',
        thresholds: { ring2: 0.5, ring3: 0.7, win: 0.9 },
        winHoldSeconds: 1.3,
        timeLimit: 155,
        waveIntervals: { ring1: 8.4, ring2: 10.4, ring3: 13.8 },
        burstSizes: { ring1: 8, ring2: 6, ring3: 4 },
        spawnWeights: { pigment: 0.64, neutral: 0.24, special: 0.12 },
        botCount: 8,
        boss: { boss1Enabled: true, boss2Enabled: false, boss1Time: 72, boss2Time: 130, boss1Health: 520, boss2Health: 600 },
        pity: { stuckThreshold: 10, duration: 4, multiplier: 1.5 },
        ring3Debuff: { enabled: false, threshold: 0.7, duration: 2, speedMultiplier: 0.97 },
        rushWindowDuration: 5,
    },
    {
        id: 5,
        name: 'Core Run I',
        thresholds: { ring2: 0.5, ring3: 0.7, win: 0.9 },
        winHoldSeconds: 1.4,
        timeLimit: 150,
        waveIntervals: { ring1: 8.1, ring2: 10.2, ring3: 13.2 },
        burstSizes: { ring1: 8, ring2: 6, ring3: 4 },
        spawnWeights: { pigment: 0.62, neutral: 0.24, special: 0.14 },
        botCount: 10,
        boss: { boss1Enabled: true, boss2Enabled: false, boss1Time: 64, boss2Time: 125, boss1Health: 620, boss2Health: 700 },
        pity: { stuckThreshold: 11, duration: 4, multiplier: 1.48 },
        ring3Debuff: { enabled: true, threshold: 0.7, duration: 2, speedMultiplier: 0.97 },
        rushWindowDuration: 5,
    },
    {
        id: 6,
        name: 'Core Run II',
        thresholds: { ring2: 0.5, ring3: 0.7, win: 0.9 },
        winHoldSeconds: 1.5,
        timeLimit: 145,
        waveIntervals: { ring1: 8.3, ring2: 10.4, ring3: 13.8 },
        burstSizes: { ring1: 8, ring2: 6, ring3: 4 },
        spawnWeights: { pigment: 0.6, neutral: 0.25, special: 0.15 },
        botCount: 12,
        boss: { boss1Enabled: true, boss2Enabled: true, boss1Time: 58, boss2Time: 118, boss1Health: 680, boss2Health: 920 },
        pity: { stuckThreshold: 12, duration: 4, multiplier: 1.45 },
        ring3Debuff: { enabled: true, threshold: 0.7, duration: 2, speedMultiplier: 0.96 },
        rushWindowDuration: 5,
    },
];

const level7Base: LevelConfig = {
    id: 7,
    name: 'Rush I',
    thresholds: { ring2: 0.5, ring3: 0.7, win: 0.9 },
    winHoldSeconds: 1.5,
    timeLimit: 140,
    waveIntervals: { ring1: 8.2, ring2: 10.4, ring3: 13.6 },
    burstSizes: { ring1: 8, ring2: 6, ring3: 4 },
    spawnWeights: { pigment: 0.6, neutral: 0.25, special: 0.15 },
    botCount: 13,
    boss: { boss1Enabled: true, boss2Enabled: false, boss1Time: 56, boss2Time: 112, boss1Health: 720, boss2Health: 980 },
    pity: { stuckThreshold: 12, duration: 4, multiplier: 1.42 },
    ring3Debuff: { enabled: true, threshold: 0.7, duration: 2, speedMultiplier: 0.96 },
    rushWindowDuration: 5,
};

const level10Target: LevelConfig = {
    id: 10,
    name: 'Master Run',
    thresholds: { ring2: 0.5, ring3: 0.7, win: 0.9 },
    winHoldSeconds: 1.5,
    timeLimit: 120,
    waveIntervals: { ring1: 8.6, ring2: 11.2, ring3: 14.2 },
    burstSizes: { ring1: 8, ring2: 6, ring3: 4 },
    spawnWeights: { pigment: 0.6, neutral: 0.25, special: 0.15 },
    botCount: 15,
    boss: { boss1Enabled: true, boss2Enabled: false, boss1Time: 45, boss2Time: 92, boss1Health: 900, boss2Health: 1400 },
    pity: { stuckThreshold: 14, duration: 4, multiplier: 1.35 },
    ring3Debuff: { enabled: true, threshold: 0.7, duration: 2, speedMultiplier: 0.95 },
    rushWindowDuration: 5,
};

const generatedLevels: LevelConfig[] = Array.from({ length: 3 }, (_, i) => {
    const id = 7 + i;
    const t = i / 2; // 0 to 1 over 3 levels
    return {
        id,
        name: `Rush ${id - 6}`,
        thresholds: level7Base.thresholds,
        winHoldSeconds: level7Base.winHoldSeconds,
        timeLimit: lerp(level7Base.timeLimit, level10Target.timeLimit, t),
        waveIntervals: {
            ring1: lerp(level7Base.waveIntervals.ring1, level10Target.waveIntervals.ring1, t),
            ring2: lerp(level7Base.waveIntervals.ring2, level10Target.waveIntervals.ring2, t),
            ring3: lerp(level7Base.waveIntervals.ring3, level10Target.waveIntervals.ring3, t),
        },
        burstSizes: level7Base.burstSizes,
        spawnWeights: level7Base.spawnWeights,
        botCount: Math.round(lerp(level7Base.botCount, level10Target.botCount, t)),
        boss: {
            boss1Enabled: true,
            boss2Enabled: false,
            boss1Time: lerp(level7Base.boss.boss1Time, level10Target.boss.boss1Time, t),
            boss2Time: lerp(level7Base.boss.boss2Time, level10Target.boss.boss2Time, t),
            boss1Health: Math.round(lerp(level7Base.boss.boss1Health, level10Target.boss.boss1Health, t)),
            boss2Health: Math.round(lerp(level7Base.boss.boss2Health, level10Target.boss.boss2Health, t)),
        } as LevelConfig['boss'],
        pity: {
            stuckThreshold: lerp(level7Base.pity.stuckThreshold, level10Target.pity.stuckThreshold, t),
            duration: level7Base.pity.duration,
            multiplier: lerp(level7Base.pity.multiplier, level10Target.pity.multiplier, t),
        },
        ring3Debuff: {
            enabled: true,
            threshold: 0.7,
            duration: 2,
            speedMultiplier: lerp(level7Base.ring3Debuff.speedMultiplier, level10Target.ring3Debuff.speedMultiplier, t),
        },
        rushWindowDuration: level7Base.rushWindowDuration,
    };
});

export const LEVELS: LevelConfig[] = [
    ...tutorialLevels,
    ...generatedLevels,
];

export const getLevelConfig = (level: number): LevelConfig => {
    const clamped = Math.max(1, Math.min(10, Math.round(level)));
    return LEVELS[clamped - 1];
};
