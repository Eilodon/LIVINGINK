import { MutationChoice, MutationId, MutationTier, Player, SizeTier } from '../types';

export interface MutationDefinition extends MutationChoice {
  apply: (player: Player) => void;
}

const MUTATIONS: MutationDefinition[] = [
  {
    id: MutationId.Swift,
    name: 'Tốc Hành',
    tier: MutationTier.Common,
    description: '+15% tốc độ di chuyển.',
    apply: (player) => {
      player.maxSpeed *= 1.15;
    },
  },
  {
    id: MutationId.ThickSkin,
    name: 'Máu Dày',
    tier: MutationTier.Common,
    description: 'Giảm penalty tốc độ khi lớn.',
    apply: (player) => {
      player.sizePenaltyMultiplier *= 1.2;
    },
  },
  {
    id: MutationId.LightSpikes,
    name: 'Gai Nhẹ',
    tier: MutationTier.Common,
    description: 'Phản 10% sát thương nhận vào.',
    apply: (player) => {
      player.reflectDamage += 0.1;
    },
  },
  {
    id: MutationId.KillingIntent,
    name: 'Sát Khí',
    tier: MutationTier.Common,
    description: '+10% sát thương.',
    apply: (player) => {
      player.damageMultiplier *= 1.1;
    },
  },
  {
    id: MutationId.KeenHearing,
    name: 'Thính Giác',
    tier: MutationTier.Common,
    description: '+30% tầm nhìn hiệu dụng.',
    apply: (player) => {
      player.visionMultiplier *= 1.3;
    },
  },
  {
    id: MutationId.DashBoost,
    name: 'Dash Boost',
    tier: MutationTier.Rare,
    description: '+50% hiệu lực dash/skill.',
    apply: (player) => {
      player.skillDashMultiplier *= 1.5;
      player.skillPowerMultiplier *= 1.1;
    },
  },
  {
    id: MutationId.Lifesteal,
    name: 'Hút Máu',
    tier: MutationTier.Rare,
    description: 'Hồi 15% sát thương gây ra.',
    apply: (player) => {
      player.lifesteal += 0.15;
    },
  },
  {
    id: MutationId.ArmorPierce,
    name: 'Xuyên Giáp',
    tier: MutationTier.Rare,
    description: 'Bỏ qua 20% phòng thủ.',
    apply: (player) => {
      player.armorPen += 0.2;
    },
  },
  {
    id: MutationId.Stealth,
    name: 'Tàng Hình',
    tier: MutationTier.Rare,
    description: 'Đứng yên 3s để tàng hình.',
    apply: (player) => {
      player.statusEffects.stealthCharge = Math.max(player.statusEffects.stealthCharge, 0);
    },
  },
  {
    id: MutationId.PoisonTouch,
    name: 'Độc Tố',
    tier: MutationTier.Rare,
    description: 'Đòn đánh gây độc 3 DPS trong 3s.',
    apply: (player) => {
      player.poisonOnHit = true;
    },
  },
  {
    id: MutationId.DoubleCast,
    name: 'Phân Thân',
    tier: MutationTier.Epic,
    description: 'Kích hoạt kỹ năng thêm một lần.',
    apply: (player) => {
      player.doubleCast = true;
    },
  },
  {
    id: MutationId.SecondChance,
    name: 'Bất Tử',
    tier: MutationTier.Epic,
    description: 'Một lần sống lại với 1 HP.',
    apply: (player) => {
      player.reviveAvailable = true;
    },
  },
  {
    id: MutationId.SpeedSurge,
    name: 'Ma Tốc',
    tier: MutationTier.Epic,
    description: 'Dùng skill để kích hoạt tăng tốc.',
    apply: (player) => {
      player.mutationCooldowns.speedSurge = 0;
    },
  },
  {
    id: MutationId.MagneticField,
    name: 'Từ Trường',
    tier: MutationTier.Epic,
    description: 'Đẩy lùi kẻ nhỏ trong bán kính gần.',
    apply: (player) => {
      player.magneticFieldRadius = Math.max(player.magneticFieldRadius, 80);
    },
  },
  {
    id: MutationId.SoulAbsorb,
    name: 'Hấp Tinh',
    tier: MutationTier.Epic,
    description: 'Kill cho tăng trưởng gấp đôi.',
    apply: (player) => {
      player.killGrowthMultiplier *= 2;
    },
  },
  {
    id: MutationId.Rewind,
    name: 'Thời Gian Ngược',
    tier: MutationTier.Legendary,
    description: 'Kích hoạt hồi phục vị trí/HP gần nhất.',
    apply: (player) => {
      player.mutationCooldowns.rewind = 0;
    },
  },
  {
    id: MutationId.ThunderCall,
    name: 'Thiên Kiếp',
    tier: MutationTier.Legendary,
    description: 'Gọi sét vào kẻ địch gần nhất.',
    apply: (player) => {
      player.mutationCooldowns.lightning = 0;
    },
  },
  {
    id: MutationId.KingForm,
    name: 'Cổ Vương Hóa',
    tier: MutationTier.Legendary,
    description: 'Tăng sức mạnh trong 15s.',
    apply: (player) => {
      player.mutationCooldowns.kingForm = 0;
    },
  },
  {
    id: MutationId.Invulnerable,
    name: 'Bất Diệt',
    tier: MutationTier.Legendary,
    description: 'Miễn nhiễm sát thương 3s.',
    apply: (player) => {
      player.mutationCooldowns.invulnerable = 0;
    },
  },
  {
    id: MutationId.ChaosSwap,
    name: 'Hỗn Độn',
    tier: MutationTier.Legendary,
    description: 'Hoán đổi kích thước với kẻ địch.',
    apply: (player) => {
      player.mutationCooldowns.chaos = 0;
    },
  },
];

const MUTATION_BY_ID = new Map<MutationId, MutationDefinition>(
  MUTATIONS.map((mutation) => [mutation.id, mutation])
);

const tierWeightsBySizeTier: Record<SizeTier, Array<{ tier: MutationTier; weight: number }>> = {
  [SizeTier.Larva]: [
    { tier: MutationTier.Common, weight: 1 },
  ],
  [SizeTier.Juvenile]: [
    { tier: MutationTier.Common, weight: 0.75 },
    { tier: MutationTier.Rare, weight: 0.25 },
  ],
  [SizeTier.Adult]: [
    { tier: MutationTier.Common, weight: 0.55 },
    { tier: MutationTier.Rare, weight: 0.35 },
    { tier: MutationTier.Epic, weight: 0.1 },
  ],
  [SizeTier.Elder]: [
    { tier: MutationTier.Common, weight: 0.35 },
    { tier: MutationTier.Rare, weight: 0.4 },
    { tier: MutationTier.Epic, weight: 0.2 },
    { tier: MutationTier.Legendary, weight: 0.05 },
  ],
  [SizeTier.AncientKing]: [
    { tier: MutationTier.Common, weight: 0.2 },
    { tier: MutationTier.Rare, weight: 0.35 },
    { tier: MutationTier.Epic, weight: 0.3 },
    { tier: MutationTier.Legendary, weight: 0.15 },
  ],
};

const pickTier = (sizeTier: SizeTier) => {
  const weighted = tierWeightsBySizeTier[sizeTier];
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.tier;
  }
  return weighted[weighted.length - 1].tier;
};

export const getMutationById = (id: MutationId) => MUTATION_BY_ID.get(id) || null;

export const getAllMutationIds = (): MutationId[] => MUTATIONS.map((mutation) => mutation.id);

export const getMutationIdsByTier = (tier: MutationTier): MutationId[] =>
  MUTATIONS.filter((mutation) => mutation.tier === tier).map((mutation) => mutation.id);

export const getMutationChoices = (
  owned: Set<MutationId>,
  sizeTier: SizeTier,
  count: number,
  allowed?: Set<MutationId>
): MutationChoice[] => {
  const choices: MutationChoice[] = [];
  const attemptsLimit = 40;
  let attempts = 0;

  while (choices.length < count && attempts < attemptsLimit) {
    attempts += 1;
    const tier = pickTier(sizeTier);
    const pool = MUTATIONS.filter((mutation) => {
      if (mutation.tier !== tier) return false;
      if (owned.has(mutation.id)) return false;
      if (allowed && !allowed.has(mutation.id)) return false;
      return true;
    });
    if (!pool.length) continue;
    const mutation = pool[Math.floor(Math.random() * pool.length)];
    if (choices.some((choice) => choice.id === mutation.id)) continue;
    choices.push({
      id: mutation.id,
      name: mutation.name,
      tier: mutation.tier,
      description: mutation.description,
    });
  }

  if (choices.length < count) {
    const fallbackPool = MUTATIONS.filter((mutation) => {
      if (owned.has(mutation.id)) return false;
      if (choices.some((choice) => choice.id === mutation.id)) return false;
      if (allowed && !allowed.has(mutation.id)) return false;
      return true;
    });
    while (choices.length < count && fallbackPool.length > 0) {
      const mutation = fallbackPool.splice(Math.floor(Math.random() * fallbackPool.length), 1)[0];
      choices.push({
        id: mutation.id,
        name: mutation.name,
        tier: mutation.tier,
        description: mutation.description,
      });
    }
  }

  return choices;
};

export const applyMutation = (player: Player, mutationId: MutationId) => {
  const mutation = MUTATION_BY_ID.get(mutationId);
  if (!mutation) return;
  mutation.apply(player);
  if (!player.mutations.includes(mutationId)) {
    player.mutations.push(mutationId);
  }
};

export const getMutationChoicesByTier = (
  owned: Set<MutationId>,
  tier: MutationTier,
  count: number,
  allowed?: Set<MutationId>
): MutationChoice[] => {
  const pool = MUTATIONS.filter((mutation) => {
    if (mutation.tier !== tier) return false;
    if (owned.has(mutation.id)) return false;
    if (allowed && !allowed.has(mutation.id)) return false;
    return true;
  });
  const choices: MutationChoice[] = [];
  const localPool = [...pool];
  while (choices.length < count && localPool.length > 0) {
    const mutation = localPool.splice(Math.floor(Math.random() * localPool.length), 1)[0];
    choices.push({
      id: mutation.id,
      name: mutation.name,
      tier: mutation.tier,
      description: mutation.description,
    });
  }
  return choices;
};
