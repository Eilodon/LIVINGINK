
import { TattooId, MutationTier, Player } from '../../types';

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
        description: 'Reduce impact of wrong pigments.',
        apply: () => { }
    },
    {
        id: TattooId.Overdrive,
        name: 'Overdrive',
        tier: MutationTier.Common,
        description: 'Skill triggers 3s fast-eat.',
        apply: () => { }
    },
    {
        id: TattooId.DepositShield,
        name: 'Deposit Shield',
        tier: MutationTier.Common,
        description: 'Gain shield while holding core.',
        apply: () => { }
    },
    {
        id: TattooId.PigmentBomb,
        name: 'Pigment Bomb',
        tier: MutationTier.Common,
        description: 'Getting hit splashes color on enemy.',
        apply: () => { }
    },
    {
        id: TattooId.PerfectMatch,
        name: 'Perfect Match Bonus',
        tier: MutationTier.Rare,
        description: 'High match grants extra reward.',
        apply: () => { }
    },
    {
        id: TattooId.CatalystSense,
        name: 'Catalyst Sense',
        tier: MutationTier.Rare,
        description: 'Attract catalysts from farther.',
        apply: () => { }
    },
    {
        id: TattooId.NeutralMastery,
        name: 'Neutral Mastery',
        tier: MutationTier.Rare,
        description: 'Neutral gives extra mass.',
        apply: () => { }
    },
    {
        id: TattooId.SolventExpert,
        name: 'Solvent Expert',
        tier: MutationTier.Epic,
        description: 'Solvent cleanses faster.',
        apply: () => { }
    }
];

export const getTattooById = (id: TattooId) => TATTOOS.find(t => t.id === id);

export const applyTattoo = (player: Player, id: TattooId) => {
    const t = getTattooById(id);
    if (t) {
        if (!player.tattoos.includes(id)) {
            player.tattoos.push(id);
            t.apply(player);
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
