
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
        id: TattooId.Swift,
        name: 'Ink Flow',
        tier: MutationTier.Common,
        description: 'Movement Speed +15%',
        apply: (p) => { p.statusEffects.speedBoost = (p.statusEffects.speedBoost || 0) + 0.15; }
    },
    {
        id: TattooId.ThickSkin,
        name: 'Hardened Gel',
        tier: MutationTier.Common,
        description: 'Reduce size penalty on speed.',
        apply: (p) => { p.sizePenaltyMultiplier *= 0.8; }
    },
    {
        id: TattooId.KillingIntent,
        name: 'Spiked Pigment',
        tier: MutationTier.Common,
        description: 'Damage +10%.',
        apply: (p) => { p.damageMultiplier += 0.1; }
    },
    {
        id: TattooId.KeenHearing,
        name: 'Vibration Sense',
        tier: MutationTier.Common,
        description: 'Vision Range +30%.',
        apply: (p) => { p.visionMultiplier += 0.3; }
    },
    {
        id: TattooId.DashBoost,
        name: 'Jet Stream',
        tier: MutationTier.Rare,
        description: 'Dash efficiency +50%.',
        apply: (p) => { p.skillDashMultiplier += 0.5; }
    },
    {
        id: TattooId.Lifesteal,
        name: 'Absorb',
        tier: MutationTier.Rare,
        description: 'Heal 15% of damage dealt.',
        apply: (p) => { p.lifesteal += 0.15; }
    },
    {
        id: TattooId.ArmorPierce,
        name: 'Corrosive Touch',
        tier: MutationTier.Rare,
        description: 'Ignore 20% protection.',
        apply: (p) => { p.armorPen += 0.2; }
    },
    {
        id: TattooId.SecondChance,
        name: 'Re-Coalesce',
        tier: MutationTier.Epic,
        description: 'Revive once with 1 HP.',
        apply: (p) => { p.reviveAvailable = true; }
    },
    {
        id: TattooId.SpeedSurge,
        name: 'Turbo Injector',
        tier: MutationTier.Epic,
        description: 'Skills grant temporary speed boost.',
        apply: (p) => { /* Logic in system */ }
    },
    {
        id: TattooId.MagneticField,
        name: 'Vortex',
        tier: MutationTier.Epic,
        description: 'Passively pull small drops.',
        apply: (p) => { p.magneticFieldRadius = 150; }
    },
    {
        id: TattooId.SoulAbsorb,
        name: 'Gluttony',
        tier: MutationTier.Epic,
        description: 'Doubles mass gain from kills.',
        apply: (p) => { p.killGrowthMultiplier += 1.0; }
    },
    {
        id: TattooId.Rewind,
        name: 'Time Anchor',
        tier: MutationTier.Legendary,
        description: 'Teleport back to 3s ago when hit hard.',
        apply: (p) => { /* Logic in system */ }
    },
    {
        id: TattooId.ThunderCall,
        name: 'Storm Caller',
        tier: MutationTier.Legendary,
        description: 'Strikes nearby enemies with lightning.',
        apply: (p) => { /* Logic in system */ }
    },
    {
        id: TattooId.KingForm,
        name: 'Apex Predator',
        tier: MutationTier.Legendary,
        description: 'Briefly grow gargantuan on skill use.',
        apply: (p) => { /* Logic in system */ }
    },
    {
        id: TattooId.Invulnerable,
        name: 'Phase Shift',
        tier: MutationTier.Legendary,
        description: 'Become intangible for 3s when low HP.',
        apply: (p) => { /* Logic in system */ }
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
