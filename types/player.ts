import { Entity, Vector2 } from './entity';
import { SizeTier, MutationTier } from './shared';
export type { SizeTier, MutationTier };
import { PigmentVec3, RingId, Emotion, ShapeId, TattooId } from '../services/cjr/cjrTypes';

export function isPlayerOrBot(entity: Entity): entity is Player | Bot {
    return 'score' in entity;
}

// Status Effects Interface
export interface StatusEffects {
    speedBoost: number;
    tempSpeedBoost: number;
    tempSpeedTimer: number;
    shielded: boolean;
    burning: boolean;
    burnTimer: number;
    slowed: boolean;
    slowTimer: number;
    slowMultiplier: number;
    poisoned: boolean;
    poisonTimer: number;
    regen: number;
    airborne: boolean;
    stealthed: boolean;
    stealthCharge: number;
    invulnerable: number;
    rooted: number;
    speedSurge: number;
    kingForm: number;
    damageBoost: number;
    defenseBoost: number;
    // New CJR buffs
    commitShield?: number;
    pityBoost?: number;
    colorBoostTimer?: number;
    colorBoostMultiplier?: number;
    overdriveTimer?: number;
    magnetTimer?: number;
    // Tattoo Effects
    wrongPigmentReduction?: number;
    overdriveActive?: boolean;
    coreShieldBonus?: boolean;
    pigmentBombActive?: boolean;
    pigmentBombChance?: number;
    perfectMatchThreshold?: number;
    perfectMatchBonus?: number;
    catalystSenseRange?: number;
    catalystSenseActive?: boolean;
    neutralMassBonus?: number;
    solventPower?: number;
    solventSpeedBoost?: number;
    catalystEchoBonus?: number;
    catalystEchoDuration?: number;
    prismGuardThreshold?: number;
    prismGuardReduction?: number;
    grimHarvestDropCount?: number;

    // Tattoo Synergy Effects - Phase 2 Gameplay Depth
    neutralPurification?: boolean;
    purificationRadius?: number;
    overdriveExplosive?: boolean;
    explosiveSpeed?: number;
    explosionRadius?: number;
    goldenAttraction?: boolean;
    catalystAttractionRadius?: number;
    goldenMagneticForce?: number;
    elementalBalance?: boolean;
    solventShieldPower?: number;
    shieldSolventSynergy?: boolean;
    colorImmunity?: boolean;
    chromaticImmunityDuration?: number;
    catalystMasteryRadius?: number;
    catalystGuarantee?: boolean;
    neutralGodMode?: boolean;
    kineticExplosion?: boolean;
    explosionDamage?: number;
    shieldPiercing?: boolean;
    absoluteMastery?: boolean;
    colorControl?: number;
    temporalDistortion?: boolean;
    timeManipulation?: number;
    speedAmplifier?: number;
    explosionTimeDilation?: number;
}

export interface Player extends Entity {
    name: string;
    score: number;
    kills: number;
    inputEvents?: any[];
    // Dopamine Stats
    killStreak: number;
    streakTimer: number; // Decays to 0
    maxHealth: number;
    currentHealth: number;
    tier: SizeTier;
    targetPosition: Vector2; // Mouse/Input target
    spawnTime: number;

    // CJR Core Fields
    pigment: PigmentVec3;
    targetPigment: PigmentVec3;
    matchPercent: number; // 0..1
    ring: RingId;
    emotion: Emotion;
    shape: ShapeId;
    tattoos: TattooId[];
    lastHitTime: number;
    lastEatTime: number;
    matchStuckTime: number;
    ring3LowMatchTime: number;
    emotionTimer: number;
    emotionOverride?: Emotion;

    // Physics Props
    acceleration: number;
    maxSpeed: number;
    friction: number;

    // Mechanics
    isInvulnerable: boolean;
    skillCooldown: number;
    maxSkillCooldown: number;
    inputs?: {
        space: boolean;
        w: boolean;
    };
    inputSeq?: number;

    // RPG Stats (Simplified)
    defense: number;
    damageMultiplier: number;

    // Tattoo Stats (formerly mutations, now consolidated)
    critChance: number;
    critMultiplier: number;
    lifesteal: number;
    armorPen: number;
    reflectDamage: number;
    visionMultiplier: number;
    sizePenaltyMultiplier: number;
    skillCooldownMultiplier: number;
    skillPowerMultiplier: number;
    skillDashMultiplier: number;
    killGrowthMultiplier: number;
    poisonOnHit: boolean;
    doubleCast: boolean;
    reviveAvailable: boolean;
    magneticFieldRadius: number;

    mutationCooldowns: {
        speedSurge: number;
        invulnerable: number;
        rewind: number;
        lightning: number;
        chaos: number;
        kingForm: number;
    };
    rewindHistory: { position: Vector2; health: number; time: number }[];
    stationaryTime: number;

    // Status Effects
    statusEffects: StatusEffects;
}

export interface Bot extends Player {
    aiState: 'wander' | 'chase' | 'flee' | 'forage';
    targetEntityId: string | null;
    aiReactionTimer: number;
    isCreep?: boolean;
    creepType?: string;
    isElite?: boolean;
    isBoss?: boolean;
    bossAttackTimer?: number;
    bossAttackCharge?: number;
    respawnTimer?: number;
    // CJR Bot Personality
    personality?: 'farmer' | 'hunter' | 'bully' | 'greedy' | 'trickster' | 'rubber';
}

export interface TattooChoice {
    id: string;
    name: string;
    tier: MutationTier;
    description: string;
}

export interface MatchSummary {
    score: number;
    kills: number;
}

export interface PlayerProfile {
    gamesPlayed: number;
    totalKills: number;
    highScore: number;
    unlockedSkins: string[];
    unlockedTattoos: string[];
    cosmetics?: {
        ownedSkins: string[];
        ownedTrails: string[];
        ownedAuras: string[];
        ownedBadges: string[];
        active: {
            skin?: string;
            trail?: string;
            aura?: string;
            badge?: string;
        };
    };
    quests?: {
        daily: Record<string, number>;
        weekly: Record<string, number>;
        lastReset: number;
    };
    guildId?: string | null;
    lastUpdated: number;
}
