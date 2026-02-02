import { MutationTier, Player, Bot, Food, GameState } from '../../types';
import { TattooId } from './cjrTypes';
import { COLOR_BALANCE } from './balance';
import { vfxIntegrationManager } from '../vfx/vfxIntegration';
import { mixPigment, calcMatchPercentFast, pigmentToHex, pigmentToInt } from './colorMath';
import { createFloatingText } from '../engine/effects';
import { createParticle, createFood } from '../engine/factories';
import { StatusFlag, TattooFlag } from '../engine/statusFlags';
import { EntityStateBridge } from '../engine/dod/EntityStateBridge';

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
      player.statusScalars.wrongPigmentReduction = 0.6; // 40% reduction
    },
    onConsume: (entity: Player | Bot, food: Food, state: GameState) => {
      if (food.kind === 'pigment' && food.pigment) {
        const pigmentMatch = calcMatchPercentFast(food.pigment, entity.targetPigment);
        if (pigmentMatch < 0.6) {
          // Handled in combat.ts logic via statusScalars.wrongPigmentReduction
        }
      }
    },
  },
  {
    id: TattooId.Overdrive,
    name: 'Overdrive',
    tier: MutationTier.Common,
    description: 'Skill triggers 3s fast-eat mode.',
    apply: (player: Player) => {
      player.tattooFlags |= TattooFlag.OVERDRIVE_ACTIVE;
    },
    onSkill: (player: Player, state: GameState) => {
      player.statusTimers.overdrive = 3.0; // 3s boost to growth
      createFloatingText(player.position, 'Overdrive!', '#FF5722', 20, state);
    },
  },
  {
    id: TattooId.DepositShield,
    name: 'Deposit Shield',
    tier: MutationTier.Common,
    description: 'Gain shield while holding core (Ring 3).',
    apply: (player: Player) => {
      player.tattooFlags |= TattooFlag.CORE_SHIELD_BONUS;
    },
    onUpdate: (player: Player, dt: number, state: GameState) => {
      // If in Ring 3 and high match (holding), grant shield
      if (player.ring === 3 && player.matchPercent > 0.8) {
        player.statusFlags |= StatusFlag.SHIELDED;
        player.statusScalars.commitShield = 0.1; // Refreshing shield
      }
    },
  },
  {
    id: TattooId.PigmentBomb,
    name: 'Pigment Bomb',
    tier: MutationTier.Common,
    description: 'Getting hit splashes 30% of your color on enemy.',
    apply: (player: Player) => {
      player.tattooFlags |= TattooFlag.PIGMENT_BOMB_ACTIVE;
      player.statusScalars.pigmentBombChance = 0.3;
    },
    onHit: (victim: Player | Bot, attacker: Player | Bot, state: GameState) => {
      if (victim.tattoos?.includes(TattooId.PigmentBomb)) {
        const chance = victim.statusScalars.pigmentBombChance || 0.3;
        if (Math.random() < chance && 'pigment' in attacker) {
          const att = attacker as Player | Bot;
          att.pigment = mixPigment(att.pigment, victim.pigment, 0.15);
          att.color = pigmentToInt(att.pigment);
          att.matchPercent = calcMatchPercentFast(att.pigment, att.targetPigment);
          createFloatingText(att.position, 'INKED!', '#ff66cc', 18, state);
        }
      }
    },
  },
  {
    id: TattooId.PerfectMatch,
    name: 'Perfect Match Bonus',
    tier: MutationTier.Rare,
    description: 'Match ≥85% grants 50% extra mass and speed.',
    apply: (player: Player) => {
      player.statusScalars.perfectMatchThreshold = 0.85;
      player.statusMultipliers.perfectMatch = 1.5;
    },
    onUpdate: (player: Player, dt: number, state: GameState) => {
      if (player.matchPercent >= 0.85) {
        const curr = EntityStateBridge.getSpeedMultiplier(player);
        EntityStateBridge.setSpeedMultiplier(player, Math.max(curr, 1.2));
      }
    },
  },
  {
    id: TattooId.CatalystSense,
    name: 'Catalyst Sense',
    tier: MutationTier.Rare,
    description: 'Attract catalysts from 2x distance and highlight them.',
    apply: (player: Player) => {
      player.statusScalars.catalystSenseRange = 2.0;
      player.tattooFlags |= TattooFlag.CATALYST_SENSE_ACTIVE;
    },
  },
  {
    id: TattooId.NeutralMastery,
    name: 'Neutral Mastery',
    tier: MutationTier.Rare,
    description: 'Neutral pickups give 25% extra mass.',
    apply: (player: Player) => {
      player.statusMultipliers.neutralMass = 1.25;
    },
  },
  {
    id: TattooId.SolventExpert,
    name: 'Solvent Expert',
    tier: MutationTier.Epic,
    description: 'Solvent cleanses 2x faster and provides brief speed boost.',
    apply: (player: Player) => {
      player.statusMultipliers.solventPower = 2.0;
      player.statusScalars.solventSpeedBoost = 1.2;
    },
  },
  {
    id: TattooId.CatalystEcho,
    name: 'Catalyst Echo',
    tier: MutationTier.Common,
    description: 'Catalysts last longer and grant extra mass.',
    apply: (player: Player) => {
      player.statusMultipliers.catalystEcho = 1.3;
      player.statusTimers.catalystEcho = 2.0;
    },
  },
  {
    id: TattooId.PrismGuard,
    name: 'Prism Guard',
    tier: MutationTier.Rare,
    description: 'Match ≥80% reduces incoming damage by 20%.',
    apply: (player: Player) => {
      player.statusScalars.prismGuardThreshold = 0.8;
      player.statusMultipliers.prismGuardReduction = 0.8;
    },
  },
  {
    id: TattooId.InkLeech,
    name: 'Ink Leech',
    tier: MutationTier.Epic,
    description: 'Deal damage to heal for 20% of it.',
    apply: (player: Player) => {
      player.lifesteal = Math.max(player.lifesteal || 0, 0.2);
    },
  },
  {
    id: TattooId.GrimHarvest,
    name: 'Grim Harvest',
    tier: MutationTier.Epic,
    description: 'Killing enemies spawns neutral mass.',
    apply: (player: Player) => {
      player.statusScalars.grimHarvestDropCount = 2;
    },
  },

  // --- NEW TATTOOS ---
  {
    id: TattooId.SpeedSurge,
    name: 'Speed Surge',
    tier: MutationTier.Common,
    description: 'Passive 15% speed boost. Dash is cheaper.',
    apply: (player: Player) => {
      player.statusScalars.speedSurge = 1;
      const curr = EntityStateBridge.getSpeedMultiplier(player);
      EntityStateBridge.setSpeedMultiplier(player, Math.max(curr, 1.15));
      player.skillCooldownMultiplier = 1.5; // Faster recharge
    },
  },
  {
    id: TattooId.Invulnerable,
    name: 'Titan Skin',
    tier: MutationTier.Epic,
    description: 'Start with 3s invulnerability. Gain 50% defense.',
    apply: (player: Player) => {
      player.statusTimers.invulnerable = 3.0; // Start invuln
      const def = EntityStateBridge.getDefense(player);
      EntityStateBridge.setDefense(player, def * 1.5);
    },
  },
  {
    id: TattooId.Rewind,
    name: 'Time Anchor',
    tier: MutationTier.Legendary,
    description: 'Fatal damage restores 50% HP and rewinds position (once/run).',
    apply: (player: Player) => {
      player.reviveAvailable = true;
    },
    onUpdate: (player: Player, dt: number, state: GameState) => {
      // Record history for rewind? (Heavy, maybe simplify to just revive)
    },
  },
  {
    id: TattooId.Magnet,
    name: 'Void Magnet',
    tier: MutationTier.Rare,
    description: 'Significantly increased pickup radius.',
    apply: (player: Player) => {
      EntityStateBridge.setMagnetRadius(player, 150);
      player.statusTimers.magnet = 9999;
    },
  },
  {
    id: TattooId.KingForm,
    name: 'Crown of Light',
    tier: MutationTier.Legendary,
    description: 'Win requirement reduced to 85%. You glow with authority.',
    apply: (player: Player) => {
      // Logic handled in winCondition.ts to check this ID?
      // Or just reduce threshold directly if possible, but threshold is constant.
      // We can check tattoos in winCondition logic.
    },
  },
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
    description: m.description,
  }));
};
