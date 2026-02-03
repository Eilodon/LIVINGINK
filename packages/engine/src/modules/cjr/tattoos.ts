/**
 * @cjr/engine - Tattoos System
 * Pure tattoo logic - VFX decoupled via eventBuffer
 */

import { TattooId, MutationTier, type PigmentVec3 } from './types';
import { eventBuffer, EngineEventType, TEXT_IDS } from '../../events/EventRingBuffer';
import { mixPigment, calcMatchPercentFast, pigmentToInt } from './colorMath';

/**
 * Minimal entity interface for tattoo operations
 */
export interface ITattooEntity {
    physicsIndex?: number;
    position: { x: number; y: number };
    ring: 1 | 2 | 3;
    matchPercent: number;
    pigment: PigmentVec3;
    targetPigment: PigmentVec3;
    color: number;
    isDead: boolean;
    tattoos: TattooId[];
    tattooFlags: number;
    statusFlags: number;
    statusScalars: Record<string, number>;
    statusMultipliers: Record<string, number>;
    statusTimers: Record<string, number>;
    lifesteal?: number;
    reviveAvailable?: boolean;
    skillCooldownMultiplier?: number;
}

export interface ITattooFood {
    kind: string;
    pigment?: PigmentVec3;
}

/**
 * Tattoo Flag Enum (mirrors client TattooFlag)
 */
export const enum TattooFlag {
    NONE = 0,
    OVERDRIVE_ACTIVE = 1 << 0,
    CORE_SHIELD_BONUS = 1 << 1,
    PIGMENT_BOMB_ACTIVE = 1 << 2,
    CATALYST_SENSE_ACTIVE = 1 << 3,
}

/**
 * Status Flag Enum (mirrors client StatusFlag)
 */
export const enum StatusFlag {
    NONE = 0,
    SHIELDED = 1 << 0,
    INVULNERABLE = 1 << 1,
    STUNNED = 1 << 2,
}

export interface TattooDefinition {
    id: TattooId;
    name: string;
    tier: MutationTier;
    description: string;
    apply: (entity: ITattooEntity) => void;
    onConsume?: (entity: ITattooEntity, food: ITattooFood) => void;
    onHit?: (victim: ITattooEntity, attacker: ITattooEntity) => void;
    onSkill?: (entity: ITattooEntity) => void;
    onUpdate?: (entity: ITattooEntity, dt: number) => void;
}

const TATTOOS: TattooDefinition[] = [
    {
        id: TattooId.FilterInk,
        name: 'Filter Ink',
        tier: MutationTier.Common,
        description: 'Reduce impact of wrong pigments by 40%.',
        apply: (entity) => {
            entity.statusScalars.wrongPigmentReduction = 0.6;
        },
        onConsume: (entity, food) => {
            if (food.kind === 'pigment' && food.pigment) {
                const pigmentMatch = calcMatchPercentFast(food.pigment, entity.targetPigment);
                if (pigmentMatch < 0.6) {
                    // Handled via statusScalars.wrongPigmentReduction
                }
            }
        },
    },
    {
        id: TattooId.Overdrive,
        name: 'Overdrive',
        tier: MutationTier.Common,
        description: 'Skill triggers 3s fast-eat mode.',
        apply: (entity) => {
            entity.tattooFlags |= TattooFlag.OVERDRIVE_ACTIVE;
        },
        onSkill: (entity) => {
            entity.statusTimers.overdrive = 3.0;
            // Emit floating text event instead of direct VFX call
            eventBuffer.push(
                EngineEventType.FLOATING_TEXT,
                entity.physicsIndex ?? 0,
                entity.position.x,
                entity.position.y,
                TEXT_IDS.OVERDRIVE
            );
        },
    },
    {
        id: TattooId.DepositShield,
        name: 'Deposit Shield',
        tier: MutationTier.Common,
        description: 'Gain shield while holding core (Ring 3).',
        apply: (entity) => {
            entity.tattooFlags |= TattooFlag.CORE_SHIELD_BONUS;
        },
        onUpdate: (entity, _dt) => {
            if (entity.ring === 3 && entity.matchPercent > 0.8) {
                entity.statusFlags |= StatusFlag.SHIELDED;
                entity.statusScalars.commitShield = 0.1;
            }
        },
    },
    {
        id: TattooId.PigmentBomb,
        name: 'Pigment Bomb',
        tier: MutationTier.Common,
        description: 'Getting hit splashes 30% of your color on enemy.',
        apply: (entity) => {
            entity.tattooFlags |= TattooFlag.PIGMENT_BOMB_ACTIVE;
            entity.statusScalars.pigmentBombChance = 0.3;
        },
        onHit: (victim, attacker) => {
            if (victim.tattoos?.includes(TattooId.PigmentBomb)) {
                const chance = victim.statusScalars.pigmentBombChance || 0.3;
                if (Math.random() < chance && 'pigment' in attacker) {
                    attacker.pigment = mixPigment(attacker.pigment, victim.pigment, 0.15);
                    attacker.color = pigmentToInt(attacker.pigment);
                    attacker.matchPercent = calcMatchPercentFast(attacker.pigment, attacker.targetPigment);
                    // Emit floating text event
                    eventBuffer.push(
                        EngineEventType.FLOATING_TEXT,
                        attacker.physicsIndex ?? 0,
                        attacker.position.x,
                        attacker.position.y,
                        TEXT_IDS.INKED
                    );
                }
            }
        },
    },
    {
        id: TattooId.PerfectMatch,
        name: 'Perfect Match Bonus',
        tier: MutationTier.Rare,
        description: 'Match ≥85% grants 50% extra mass and speed.',
        apply: (entity) => {
            entity.statusScalars.perfectMatchThreshold = 0.85;
            entity.statusMultipliers.perfectMatch = 1.5;
        },
        onUpdate: (entity, _dt) => {
            if (entity.matchPercent >= 0.85) {
                const curr = entity.statusMultipliers.speed || 1;
                entity.statusMultipliers.speed = Math.max(curr, 1.2);
            }
        },
    },
    {
        id: TattooId.CatalystSense,
        name: 'Catalyst Sense',
        tier: MutationTier.Rare,
        description: 'Attract catalysts from 2x distance and highlight them.',
        apply: (entity) => {
            entity.statusScalars.catalystSenseRange = 2.0;
            entity.tattooFlags |= TattooFlag.CATALYST_SENSE_ACTIVE;
        },
    },
    {
        id: TattooId.NeutralMastery,
        name: 'Neutral Mastery',
        tier: MutationTier.Rare,
        description: 'Neutral pickups give 25% extra mass.',
        apply: (entity) => {
            entity.statusMultipliers.neutralMass = 1.25;
        },
    },
    {
        id: TattooId.SolventExpert,
        name: 'Solvent Expert',
        tier: MutationTier.Epic,
        description: 'Solvent cleanses 2x faster and provides brief speed boost.',
        apply: (entity) => {
            entity.statusMultipliers.solventPower = 2.0;
            entity.statusScalars.solventSpeedBoost = 1.2;
        },
    },
    {
        id: TattooId.CatalystEcho,
        name: 'Catalyst Echo',
        tier: MutationTier.Common,
        description: 'Catalysts last longer and grant extra mass.',
        apply: (entity) => {
            entity.statusMultipliers.catalystEcho = 1.3;
            entity.statusTimers.catalystEcho = 2.0;
        },
    },
    {
        id: TattooId.PrismGuard,
        name: 'Prism Guard',
        tier: MutationTier.Rare,
        description: 'Match ≥80% reduces incoming damage by 20%.',
        apply: (entity) => {
            entity.statusScalars.prismGuardThreshold = 0.8;
            entity.statusMultipliers.prismGuardReduction = 0.8;
        },
    },
    {
        id: TattooId.InkLeech,
        name: 'Ink Leech',
        tier: MutationTier.Epic,
        description: 'Deal damage to heal for 20% of it.',
        apply: (entity) => {
            entity.lifesteal = Math.max(entity.lifesteal || 0, 0.2);
        },
    },
    {
        id: TattooId.GrimHarvest,
        name: 'Grim Harvest',
        tier: MutationTier.Epic,
        description: 'Killing enemies spawns neutral mass.',
        apply: (entity) => {
            entity.statusScalars.grimHarvestDropCount = 2;
        },
    },
    {
        id: TattooId.SpeedSurge,
        name: 'Speed Surge',
        tier: MutationTier.Common,
        description: 'Passive 15% speed boost. Dash is cheaper.',
        apply: (entity) => {
            entity.statusScalars.speedSurge = 1;
            const curr = entity.statusMultipliers.speed || 1;
            entity.statusMultipliers.speed = Math.max(curr, 1.15);
            entity.skillCooldownMultiplier = 1.5;
        },
    },
    {
        id: TattooId.Invulnerable,
        name: 'Titan Skin',
        tier: MutationTier.Epic,
        description: 'Start with 3s invulnerability. Gain 50% defense.',
        apply: (entity) => {
            entity.statusTimers.invulnerable = 3.0;
            const def = entity.statusMultipliers.defense || 1;
            entity.statusMultipliers.defense = def * 1.5;
        },
    },
    {
        id: TattooId.Rewind,
        name: 'Time Anchor',
        tier: MutationTier.Legendary,
        description: 'Fatal damage restores 50% HP and rewinds position (once/run).',
        apply: (entity) => {
            entity.reviveAvailable = true;
        },
    },
    {
        id: TattooId.Magnet,
        name: 'Void Magnet',
        tier: MutationTier.Rare,
        description: 'Significantly increased pickup radius.',
        apply: (entity) => {
            entity.statusScalars.magnetRadius = 150;
            entity.statusTimers.magnet = 9999;
        },
    },
    {
        id: TattooId.KingForm,
        name: 'Crown of Light',
        tier: MutationTier.Legendary,
        description: 'Win requirement reduced to 85%. You glow with authority.',
        apply: (_entity) => {
            // Logic handled in winCondition.ts
        },
    },
];

export const getTattooById = (id: TattooId): TattooDefinition | undefined =>
    TATTOOS.find(t => t.id === id);

/**
 * Apply a tattoo to an entity
 * Emits TATTOO_ACTIVATE event for VFX (handled by client bridge)
 */
export const applyTattoo = (entity: ITattooEntity, id: TattooId): boolean => {
    const t = getTattooById(id);
    if (t && !entity.tattoos.includes(id)) {
        entity.tattoos.push(id);
        t.apply(entity);

        // Emit tattoo activation event (client will handle VFX)
        eventBuffer.push(
            EngineEventType.TATTOO_ACTIVATE,
            entity.physicsIndex ?? 0,
            entity.position.x,
            entity.position.y,
            id.charCodeAt(0) // Pack first char of ID for lookup
        );

        return true;
    }
    return false;
};

/**
 * Trigger tattoo onSkill hooks for an entity
 */
export const triggerTattooOnSkill = (entity: ITattooEntity): void => {
    for (const id of entity.tattoos) {
        const def = getTattooById(id);
        def?.onSkill?.(entity);
    }
};

/**
 * Trigger tattoo onHit hooks
 */
export const triggerTattooOnHit = (
    victim: ITattooEntity,
    attacker: ITattooEntity
): void => {
    for (const id of victim.tattoos) {
        const def = getTattooById(id);
        def?.onHit?.(victim, attacker);
    }
};

/**
 * Trigger tattoo onConsume hooks
 */
export const triggerTattooOnConsume = (
    entity: ITattooEntity,
    food: ITattooFood
): void => {
    for (const id of entity.tattoos) {
        const def = getTattooById(id);
        def?.onConsume?.(entity, food);
    }
};

/**
 * Trigger tattoo onUpdate hooks
 */
export const triggerTattooOnUpdate = (
    entity: ITattooEntity,
    dt: number
): void => {
    for (const id of entity.tattoos) {
        const def = getTattooById(id);
        def?.onUpdate?.(entity, dt);
    }
};

export interface TattooChoice {
    id: TattooId;
    name: string;
    tier: MutationTier;
    description: string;
}

export const getTattooChoices = (count: number): TattooChoice[] => {
    const shuffled = [...TATTOOS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(m => ({
        id: m.id,
        name: m.name,
        tier: m.tier,
        description: m.description,
    }));
};

export const getAllTattoos = (): TattooDefinition[] => [...TATTOOS];
