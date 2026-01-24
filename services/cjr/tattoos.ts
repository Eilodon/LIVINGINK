
import { TattooId, MutationTier, Player } from '../../types';
import { COLOR_BALANCE } from './balance';
import { vfxIntegrationManager } from '../vfx/vfxIntegration';

export interface TattooDefinition {
    id: TattooId;
    name: string;
    tier: MutationTier;
    description: string;
    apply: (player: Player) => void;
}

const TATTOOS: TattooDefinition[] = [
    {
        id: TattooId.FilterInk,
        name: 'Filter Ink',
        tier: MutationTier.Common,
        description: 'Reduce impact of wrong pigments by 40%.',
        apply: (player: Player) => {
            player.statusEffects.wrongPigmentReduction = 0.6; // 40% reduction
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
