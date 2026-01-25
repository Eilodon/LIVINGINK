
import { MutationTier, Player, Bot, Food, GameState } from '../../types';
import { TattooId } from './cjrTypes';
import { COLOR_BALANCE } from './balance';
import { vfxIntegrationManager } from '../vfx/vfxIntegration';
import { mixPigment, calcMatchPercent, pigmentToHex } from './colorMath';
import { createFloatingText } from '../engine/effects';

export interface TattooDefinition {
    id: TattooId;
    name: string;
    tier: MutationTier;
    description: string;
    apply: (player: Player) => void;
    // Event hooks for tattoo effects
    onConsume?: (entity: Player | Bot, food: Food, state: GameState) => void;
    onHit?: (victim: Player | Bot, attacker: Player | Bot, state: GameState) => void;
    onSkill?: (player: Player, state: GameState) => void;
    onUpdate?: (player: Player, dt: number, state: GameState) => void;
}

const TATTOOS: TattooDefinition[] = [
    {
        id: TattooId.FilterInk,
        name: 'Filter Ink',
        tier: MutationTier.Common,
        description: 'Reduce impact of wrong pigments by 40%.',
        apply: (player: Player) => {
            player.statusEffects.wrongPigmentReduction = 0.6; // 40% reduction
        },
        onConsume: (entity: Player | Bot, food: Food, state: GameState) => {
            if (food.kind === 'pigment' && food.pigment) {
                const pigmentMatch = calcMatchPercent(food.pigment, entity.targetPigment);
                if (pigmentMatch < 0.6) {
                    // Apply reduction effect here instead of in combat.ts
                    // This will be handled by the consumePickup function
                }
            }
        }
    },
    {
        id: TattooId.Overdrive,
        name: 'Overdrive',
        tier: MutationTier.Common,
        description: 'Skill triggers 3s fast-eat mode.',
        apply: (player: Player) => {
            player.statusEffects.overdriveActive = true;
        }
    },
    {
        id: TattooId.DepositShield,
        name: 'Deposit Shield',
        tier: MutationTier.Common,
        description: 'Gain shield while holding core (Ring 3).',
        apply: (player: Player) => {
            player.statusEffects.coreShieldBonus = true;
        }
    },
    {
        id: TattooId.PigmentBomb,
        name: 'Pigment Bomb',
        tier: MutationTier.Common,
        description: 'Getting hit splashes 30% of your color on enemy.',
        apply: (player: Player) => {
            player.statusEffects.pigmentBombActive = true;
            player.statusEffects.pigmentBombChance = 0.3;
        },
        onHit: (victim: Player | Bot, attacker: Player | Bot, state: GameState) => {
            if (victim.tattoos?.includes(TattooId.PigmentBomb)) {
                const chance = victim.statusEffects.pigmentBombChance || 0.3;
                if (Math.random() < chance && 'pigment' in attacker) {
                    const att = attacker as Player | Bot;
                    att.pigment = mixPigment(att.pigment, victim.pigment, 0.15);
                    att.color = pigmentToHex(att.pigment);
                    att.matchPercent = calcMatchPercent(att.pigment, att.targetPigment);
                    createFloatingText(att.position, 'INKED!', '#ff66cc', 18, state);
                }
            }
        }
    },
    {
        id: TattooId.PerfectMatch,
        name: 'Perfect Match Bonus',
        tier: MutationTier.Rare,
        description: 'Match ≥85% grants 50% extra mass and speed.',
        apply: (player: Player) => {
            player.statusEffects.perfectMatchThreshold = 0.85;
            player.statusEffects.perfectMatchBonus = 1.5;
        }
    },
    {
        id: TattooId.CatalystSense,
        name: 'Catalyst Sense',
        tier: MutationTier.Rare,
        description: 'Attract catalysts from 2x distance and highlight them.',
        apply: (player: Player) => {
            player.statusEffects.catalystSenseRange = 2.0;
            player.statusEffects.catalystSenseActive = true;
        }
    },
    {
        id: TattooId.NeutralMastery,
        name: 'Neutral Mastery',
        tier: MutationTier.Rare,
        description: 'Neutral pickups give 25% extra mass.',
        apply: (player: Player) => {
            player.statusEffects.neutralMassBonus = 1.25;
        }
    },
    {
        id: TattooId.SolventExpert,
        name: 'Solvent Expert',
        tier: MutationTier.Epic,
        description: 'Solvent cleanses 2x faster and provides brief speed boost.',
        apply: (player: Player) => {
            player.statusEffects.solventPower = 2.0;
            player.statusEffects.solventSpeedBoost = 1.2;
        }
    },
    {
        id: TattooId.CatalystEcho,
        name: 'Catalyst Echo',
        tier: MutationTier.Common,
        description: 'Catalysts last longer and grant extra mass.',
        apply: (player: Player) => {
            player.statusEffects.catalystEchoBonus = 1.3;
            player.statusEffects.catalystEchoDuration = 2.0;
        }
    },
    {
        id: TattooId.PrismGuard,
        name: 'Prism Guard',
        tier: MutationTier.Rare,
        description: 'Match ≥80% reduces incoming damage by 20%.',
        apply: (player: Player) => {
            player.statusEffects.prismGuardThreshold = 0.8;
            player.statusEffects.prismGuardReduction = 0.8;
        }
    },
    {
        id: TattooId.InkLeech,
        name: 'Ink Leech',
        tier: MutationTier.Epic,
        description: 'Deal damage to heal for 20% of it.',
        apply: (player: Player) => {
            player.lifesteal = Math.max(player.lifesteal || 0, 0.2);
        }
    },
    {
        id: TattooId.GrimHarvest,
        name: 'Grim Harvest',
        tier: MutationTier.Epic,
        description: 'Killing enemies spawns neutral mass.',
        apply: (player: Player) => {
            player.statusEffects.grimHarvestDropCount = 2;
        }
    }
];

export const getTattooById = (id: TattooId) => TATTOOS.find(t => t.id === id);

export const applyTattoo = (player: Player, id: TattooId, state?: any) => {
    const t = getTattooById(id);
    if (t) {
        if (!player.tattoos.includes(id)) {
            player.tattoos.push(id);
            t.apply(player);

            // Play tattoo activation VFX
            if (state) {
                vfxIntegrationManager.handleTattooActivation(player, id, state);
            }
        }
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
        description: m.description
    }));
};
