import { Player, GameState } from '../../types';
import { TattooId } from './cjrTypes';
import { createFloatingText } from '../engine/effects';
import { createFood } from '../engine/factories';
import { StatusFlag, TattooFlag } from '../engine/statusFlags';
import { vfxSystem } from '../vfx/vfxSystem'; // EIDOLON-V: Static import

// Re-export needed types or define them here if not circular
export interface TattooSynergy {
    id: string;
    name: string;
    tattoos: TattooId[]; // Support 2-4 tattoos
    description: string;
    tier: 'basic' | 'advanced' | 'master' | 'legendary';
    effect: (player: Player, state: GameState) => void;
    visualEffect: {
        particleColor: string;
        particleCount: number;
        pattern: 'fusion' | 'explosion' | 'spiral' | 'geometric';
        duration: number;
    };
    unlockRequirement: {
        minPlayerLevel?: number;
        minMatchPercent?: number;
        specificSituation?: string;
    };
    cooldown: number; // Global cooldown for this synergy
}

export const createSynergyVisualEffect = (player: Player, config: {
    particleColor: string;
    particleCount: number;
    pattern: 'fusion' | 'explosion' | 'spiral' | 'geometric';
    duration: number;
}, state: GameState): void => {
    // EIDOLON-V: Push Synergy Event (Type 8)
    const meta = `${config.particleColor}:${config.pattern}`;
    vfxSystem.emitVFX(state, 8, player.position.x, player.position.y, 0, meta);
};

export const TATTOO_SYNERGIES: TattooSynergy[] = [
    // ... (Copying content from tattooSynergies.ts lines 55-453)
    // Check Step 126 for content.
    // BASIC SYNERGIES
    {
        id: 'purification_mastery',
        name: 'Purification Mastery',
        tattoos: [TattooId.FilterInk, TattooId.NeutralMastery],
        description: 'Neutral pickups now cleanse wrong pigments and provide bonus mass',
        tier: 'basic',
        effect: (player, state) => {
            player.tattooFlags |= TattooFlag.NEUTRAL_PURIFICATION;
            player.statusMultipliers.neutralMass = 1.5;
            player.statusScalars.purificationRadius = 150;
            createSynergyVisualEffect(player, { particleColor: '#E1BEE7', particleCount: 30, pattern: 'fusion', duration: 2.0 }, state);
        },
        visualEffect: { particleColor: '#E1BEE7', particleCount: 30, pattern: 'fusion', duration: 2.0 },
        unlockRequirement: { minPlayerLevel: 1 },
        cooldown: 5.0
    },
    {
        id: 'explosive_speed',
        name: 'Explosive Speed',
        tattoos: [TattooId.Overdrive, TattooId.PigmentBomb],
        description: 'Overdrive attacks create color explosions and gain speed',
        tier: 'basic',
        effect: (player, state) => {
            player.tattooFlags |= TattooFlag.OVERDRIVE_EXPLOSIVE;
            player.statusMultipliers.explosiveSpeed = 1.3;
            player.statusScalars.explosionRadius = 100;
            createSynergyVisualEffect(player, { particleColor: '#FF6B35', particleCount: 40, pattern: 'explosion', duration: 1.5 }, state);
        },
        visualEffect: { particleColor: '#FF6B35', particleCount: 40, pattern: 'explosion', duration: 1.5 },
        unlockRequirement: { minPlayerLevel: 2 },
        cooldown: 6.0
    },
    // ADVANCED
    {
        id: 'golden_attraction',
        name: 'Golden Attraction',
        tattoos: [TattooId.PerfectMatch, TattooId.CatalystSense],
        description: 'Perfect matches create golden magnetic fields that attract catalysts',
        tier: 'advanced',
        effect: (player, state) => {
            player.tattooFlags |= TattooFlag.GOLDEN_ATTRACTION;
            player.statusScalars.catalystAttractionRadius = 300;
            player.statusMultipliers.goldenMagneticForce = 2.0;
            state.food.forEach(food => {
                if (food.isDead || food.kind !== 'catalyst') return;
                const dist = Math.hypot(food.position.x - player.position.x, food.position.y - player.position.y);
                if (dist < (player.statusScalars.catalystAttractionRadius || 0)) {
                    const force = (player.statusMultipliers.goldenMagneticForce || 0) * 50;
                    const dx = player.position.x - food.position.x;
                    const dy = player.position.y - food.position.y;
                    food.velocity.x += (dx / dist) * force;
                    food.velocity.y += (dy / dist) * force;
                }
            });
            createSynergyVisualEffect(player, { particleColor: '#FFD700', particleCount: 50, pattern: 'spiral', duration: 2.5 }, state);
        },
        visualEffect: { particleColor: '#FFD700', particleCount: 50, pattern: 'spiral', duration: 2.5 },
        unlockRequirement: { minMatchPercent: 0.85 },
        cooldown: 8.0
    },
    {
        id: 'elemental_balance',
        name: 'Elemental Balance',
        tattoos: [TattooId.SolventExpert, TattooId.DepositShield],
        description: 'Solvent creates protective shields while shields enhance solvent power',
        tier: 'advanced',
        effect: (player, state) => {
            player.tattooFlags |= TattooFlag.ELEMENTAL_BALANCE;
            player.statusScalars.solventShieldPower = 2.5;
            player.tattooFlags |= TattooFlag.SHIELD_SOLVENT_SYNERGY;
            createSynergyVisualEffect(player, { particleColor: '#00BCD4', particleCount: 45, pattern: 'geometric', duration: 2.8 }, state);
        },
        visualEffect: { particleColor: '#00BCD4', particleCount: 45, pattern: 'geometric', duration: 2.8 },
        unlockRequirement: { minPlayerLevel: 3 },
        cooldown: 7.0
    },
    {
        id: 'prismatic_bulwark',
        name: 'Prismatic Bulwark',
        tattoos: [TattooId.PrismGuard, TattooId.DepositShield],
        description: 'Perfect guard window grants a stronger shield and a short speed burst',
        tier: 'advanced',
        effect: (player, state) => {
            player.statusFlags |= StatusFlag.SHIELDED;
            player.statusScalars.commitShield = Math.max(player.statusScalars.commitShield || 0, 4.0);
            player.statusMultipliers.speed = Math.max(player.statusMultipliers.speed || 1, 1.15);
            player.statusTimers.tempSpeed = Math.max(player.statusTimers.tempSpeed || 0, 3.5);
            createSynergyVisualEffect(player, { particleColor: '#F59E0B', particleCount: 40, pattern: 'geometric', duration: 2.2 }, state);
        },
        visualEffect: { particleColor: '#F59E0B', particleCount: 40, pattern: 'geometric', duration: 2.2 },
        unlockRequirement: { minPlayerLevel: 3 },
        cooldown: 8.0
    },
    {
        id: 'catalyst_surge',
        name: 'Catalyst Surge',
        tattoos: [TattooId.CatalystEcho, TattooId.PerfectMatch],
        description: 'Perfect matches surge color focus and pull nearby catalysts',
        tier: 'advanced',
        effect: (player, state) => {
            player.statusMultipliers.colorBoost = Math.max(player.statusMultipliers.colorBoost || 1, 1.8);
            player.statusTimers.colorBoost = Math.max(player.statusTimers.colorBoost || 0, 4.0);
            player.magneticFieldRadius = Math.max(player.magneticFieldRadius || 0, 180);
            player.statusTimers.magnet = Math.max(player.statusTimers.magnet || 0, 3.0);
            state.food.forEach(food => {
                if (food.isDead || food.kind !== 'catalyst') return;
                const dx = player.position.x - food.position.x;
                const dy = player.position.y - food.position.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 220 && dist > 1) {
                    const force = 120;
                    food.velocity.x += (dx / dist) * force;
                    food.velocity.y += (dy / dist) * force;
                }
            });
            createSynergyVisualEffect(player, { particleColor: '#10B981', particleCount: 45, pattern: 'spiral', duration: 2.4 }, state);
        },
        visualEffect: { particleColor: '#10B981', particleCount: 45, pattern: 'spiral', duration: 2.4 },
        unlockRequirement: { minMatchPercent: 0.82 },
        cooldown: 10.0
    },
    // MASTER
    {
        id: 'chromatic_mastery',
        name: 'Chromatic Mastery',
        tattoos: [TattooId.FilterInk, TattooId.PerfectMatch, TattooId.CatalystSense],
        description: 'Perfect matches grant temporary color immunity and massive catalyst attraction',
        tier: 'master',
        effect: (player, state) => {
            player.tattooFlags |= TattooFlag.COLOR_IMMUNITY;
            player.statusTimers.chromaticImmunity = 5.0;
            player.statusMultipliers.perfectMatch = 2.0;
            player.statusScalars.catalystMasteryRadius = 500;
            createSynergyVisualEffect(player, { particleColor: '#9C27B0', particleCount: 80, pattern: 'geometric', duration: 4.0 }, state);
            createFloatingText(player.position, 'CHROMATIC MASTERY!', '#9C27B0', 28, state);
        },
        visualEffect: { particleColor: '#9C27B0', particleCount: 80, pattern: 'geometric', duration: 4.0 },
        unlockRequirement: { minMatchPercent: 0.95 },
        cooldown: 15.0
    },
    {
        id: 'kinetic_explosion',
        name: 'Kinetic Explosion',
        tattoos: [TattooId.Overdrive, TattooId.PigmentBomb, TattooId.DepositShield],
        description: 'Overdrive attacks through shields create massive kinetic explosions',
        tier: 'master',
        effect: (player, state) => {
            player.tattooFlags |= TattooFlag.KINETIC_EXPLOSION;
            player.statusMultipliers.explosionDamage = 2.0;
            player.tattooFlags |= TattooFlag.SHIELD_PIERCING;
            createSynergyVisualEffect(player, { particleColor: '#FF5722', particleCount: 100, pattern: 'explosion', duration: 3.5 }, state);
            createFloatingText(player.position, 'KINETIC EXPLOSION!', '#FF5722', 32, state);
        },
        visualEffect: { particleColor: '#FF5722', particleCount: 100, pattern: 'explosion', duration: 3.5 },
        unlockRequirement: { minPlayerLevel: 5 },
        cooldown: 12.0
    },
    {
        id: 'blood_harvest',
        name: 'Blood Harvest',
        tattoos: [TattooId.InkLeech, TattooId.GrimHarvest, TattooId.PigmentBomb],
        description: 'Kills erupt into neutral mass and briefly empower your movement',
        tier: 'master',
        effect: (player, state) => {
            const dropCount = 3;
            for (let i = 0; i < dropCount; i++) {
                const offset = { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60 };
                const drop = createFood({ x: player.position.x + offset.x, y: player.position.y + offset.y });
                if (drop) {
                    drop.kind = 'neutral';
                    drop.color = 0x9CA3AF;
                    drop.pigment = { r: 0.5, g: 0.5, b: 0.5 };
                    state.food.push(drop);
                }
            }
            player.statusMultipliers.speed = Math.max(player.statusMultipliers.speed || 1, 1.2);
            player.statusTimers.tempSpeed = Math.max(player.statusTimers.tempSpeed || 0, 3.0);
            createSynergyVisualEffect(player, { particleColor: '#EF4444', particleCount: 60, pattern: 'explosion', duration: 2.6 }, state);
        },
        visualEffect: { particleColor: '#EF4444', particleCount: 60, pattern: 'explosion', duration: 2.6 },
        unlockRequirement: { minPlayerLevel: 6, specificSituation: 'in_combat' },
        cooldown: 14.0
    },
    // LEGENDARY
    {
        id: 'absolute_mastery',
        name: 'Absolute Mastery',
        tattoos: [TattooId.PerfectMatch, TattooId.CatalystSense, TattooId.FilterInk, TattooId.NeutralMastery],
        description: 'Unlock the full potential of color manipulation with god-like control',
        tier: 'legendary',
        effect: (player, state) => {
            player.tattooFlags |= TattooFlag.ABSOLUTE_MASTERY;
            player.statusScalars.colorControl = 1.0;
            player.statusScalars.perfectMatchThreshold = 0.7;
            player.tattooFlags |= TattooFlag.CATALYST_GUARANTEE;
            player.tattooFlags |= TattooFlag.NEUTRAL_GOD_MODE;
            createSynergyVisualEffect(player, { particleColor: '#FFD700', particleCount: 150, pattern: 'geometric', duration: 5.0 }, state);
            createFloatingText(player.position, 'ABSOLUTE MASTERY!', '#FFD700', 36, state);
        },
        visualEffect: { particleColor: '#FFD700', particleCount: 150, pattern: 'geometric', duration: 5.0 },
        unlockRequirement: { minMatchPercent: 0.98 },
        cooldown: 30.0
    },
    {
        id: 'temporal_distortion',
        name: 'Temporal Distortion',
        tattoos: [TattooId.Overdrive, TattooId.SolventExpert, TattooId.PigmentBomb],
        description: 'Manipulate time itself with speed boosts and temporal effects',
        tier: 'legendary',
        effect: (player, state) => {
            player.tattooFlags |= TattooFlag.TEMPORAL_DISTORTION;
            player.statusScalars.timeManipulation = 0.5;
            player.statusMultipliers.speedAmplifier = 3.0;
            player.statusMultipliers.explosionTimeDilation = 2.0;
            createSynergyVisualEffect(player, { particleColor: '#E91E63', particleCount: 120, pattern: 'spiral', duration: 4.5 }, state);
            createFloatingText(player.position, 'TEMPORAL DISTORTION!', '#E91E63', 34, state);
        },
        visualEffect: { particleColor: '#E91E63', particleCount: 120, pattern: 'spiral', duration: 4.5 },
        unlockRequirement: { minPlayerLevel: 8 },
        cooldown: 25.0
    }
];
