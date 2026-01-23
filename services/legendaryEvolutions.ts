/**
 * GU-KING LEGENDARY EVOLUTION SYSTEM
 *
 * When players collect specific mutation combinations,
 * they unlock powerful "Legendary Evolutions" that transform
 * their creature into an ultimate form.
 *
 * Inspired by: Vampire Survivors evolutions, Risk of Rain 2 item combos
 */

import { MutationId, Player, Faction } from '../types';
import { vfxManager } from './vfx/VFXManager';
import { audioEngine } from './audio/AudioEngine';

// ============================================
// TYPES
// ============================================

export enum LegendaryEvolutionId {
  // Damage-focused
  HuyetMaVuong = 'huyet_ma_vuong',     // Blood Demon King
  PhongThan = 'phong_than',            // Wind God
  LeiThan = 'lei_than',                // Thunder God

  // Defense-focused
  CangLongGiap = 'cang_long_giap',     // Dragon Armor
  BatDiet = 'bat_diet',                // Immortal

  // Utility-focused
  HonDon = 'hon_don',                  // Chaos
  ThoiGian = 'thoi_gian',              // Time Lord
  AmAnh = 'am_anh',                    // Shadow

  // Faction-specific
  HoaThan = 'hoa_than',                // Fire God (Fire only)
  BangVuong = 'bang_vuong',            // Ice King (Water only)
  ThachThan = 'thach_than',            // Stone God (Earth only)
  MocTinh = 'moc_tinh',                // Wood Spirit (Wood only)
  KimCuong = 'kim_cuong',              // Diamond (Metal only)
}

export interface LegendaryEvolution {
  id: LegendaryEvolutionId;
  name: string;
  title: string;
  description: string;
  requiredMutations: MutationId[];
  factionRequirement?: Faction;
  effect: (player: Player) => void;
  visualOverrides: {
    auraColor: string;
    particleEffect: string;
    sizeBonus: number;
    trailStyle: string;
  };
}

// ============================================
// LEGENDARY EVOLUTION DEFINITIONS
// ============================================

export const LEGENDARY_EVOLUTIONS: Record<LegendaryEvolutionId, LegendaryEvolution> = {
  // ==================== DAMAGE ====================
  [LegendaryEvolutionId.HuyetMaVuong]: {
    id: LegendaryEvolutionId.HuyetMaVuong,
    name: 'Huyết Ma Vương',
    title: 'Demon Lord of Blood',
    description: 'Kill = hồi 30% HP + tăng trưởng x3 + đòn đánh tiếp theo x2 damage. Bạn là ác mộng của kẻ yếu.',
    requiredMutations: [MutationId.Lifesteal, MutationId.SoulAbsorb, MutationId.KillingIntent],
    effect: (player) => {
      player.lifesteal += 0.3;
      player.killGrowthMultiplier *= 3;
      player.damageMultiplier *= 1.5;
      // Passive: next hit after kill deals 2x (handled in combat)
      (player as any).huyetMaVuongActive = true;
    },
    visualOverrides: {
      auraColor: '#dc2626',
      particleEffect: 'blood_mist',
      sizeBonus: 10,
      trailStyle: 'blood',
    },
  },

  [LegendaryEvolutionId.PhongThan]: {
    id: LegendaryEvolutionId.PhongThan,
    name: 'Phong Thần',
    title: 'God of Wind',
    description: 'Tốc độ +100%. Dash để lại vệt sát thương. Di chuyển tạo lốc xoáy nhỏ.',
    requiredMutations: [MutationId.Swift, MutationId.DashBoost, MutationId.SpeedSurge],
    effect: (player) => {
      player.maxSpeed *= 2;
      player.skillDashMultiplier *= 2;
      // Passive: movement creates damaging trail
      (player as any).phongThanActive = true;
    },
    visualOverrides: {
      auraColor: '#22d3ee',
      particleEffect: 'wind_spiral',
      sizeBonus: 5,
      trailStyle: 'wind',
    },
  },

  [LegendaryEvolutionId.LeiThan]: {
    id: LegendaryEvolutionId.LeiThan,
    name: 'Lôi Thần',
    title: 'Thunder God',
    description: 'Đòn đánh có 30% gọi sét. Skill gây chain lightning đến 3 mục tiêu.',
    requiredMutations: [MutationId.ThunderCall, MutationId.DoubleCast, MutationId.KillingIntent],
    effect: (player) => {
      player.mutationCooldowns.lightning = 0;
      // Passive: 30% chance to call lightning on hit
      (player as any).leiThanActive = true;
      (player as any).leiThanChainTargets = 3;
    },
    visualOverrides: {
      auraColor: '#facc15',
      particleEffect: 'lightning_aura',
      sizeBonus: 8,
      trailStyle: 'electric',
    },
  },

  // ==================== DEFENSE ====================
  [LegendaryEvolutionId.CangLongGiap]: {
    id: LegendaryEvolutionId.CangLongGiap,
    name: 'Cang Long Giáp',
    title: 'Dragon Armor',
    description: 'Không thể bị ăn. Phản 30% damage. Đẩy lùi tất cả kẻ địch gần.',
    requiredMutations: [MutationId.ThickSkin, MutationId.LightSpikes, MutationId.MagneticField],
    effect: (player) => {
      player.reflectDamage += 0.3;
      player.magneticFieldRadius = Math.max(player.magneticFieldRadius, 150);
      player.defense *= 1.5;
      // Passive: cannot be consumed (handled in combat)
      (player as any).cangLongGiapActive = true;
    },
    visualOverrides: {
      auraColor: '#a855f7',
      particleEffect: 'dragon_scales',
      sizeBonus: 15,
      trailStyle: 'armored',
    },
  },

  [LegendaryEvolutionId.BatDiet]: {
    id: LegendaryEvolutionId.BatDiet,
    name: 'Bất Diệt',
    title: 'The Immortal',
    description: 'Sống lại 3 lần với 50% HP. Mỗi lần chết tăng 20% damage.',
    requiredMutations: [MutationId.SecondChance, MutationId.Invulnerable, MutationId.ThickSkin],
    effect: (player) => {
      player.reviveAvailable = true;
      (player as any).batDietRevives = 3;
      (player as any).batDietDeathDamageBonus = 0;
    },
    visualOverrides: {
      auraColor: '#f8fafc',
      particleEffect: 'immortal_glow',
      sizeBonus: 5,
      trailStyle: 'ethereal',
    },
  },

  // ==================== UTILITY ====================
  [LegendaryEvolutionId.HonDon]: {
    id: LegendaryEvolutionId.HonDon,
    name: 'Hỗn Độn',
    title: 'Lord of Chaos',
    description: 'Mỗi 10s, ngẫu nhiên một hiệu ứng: teleport, đổi size, damage boost, heal, invulnerable.',
    requiredMutations: [MutationId.ChaosSwap, MutationId.Rewind, MutationId.SpeedSurge],
    effect: (player) => {
      (player as any).honDonActive = true;
      (player as any).honDonTimer = 0;
    },
    visualOverrides: {
      auraColor: '#ec4899',
      particleEffect: 'chaos_swirl',
      sizeBonus: 0,
      trailStyle: 'prismatic',
    },
  },

  [LegendaryEvolutionId.ThoiGian]: {
    id: LegendaryEvolutionId.ThoiGian,
    name: 'Thời Gian Chủ',
    title: 'Time Lord',
    description: 'Làm chậm thời gian quanh mình 50%. Cooldown giảm 50%.',
    requiredMutations: [MutationId.Rewind, MutationId.Swift, MutationId.SpeedSurge],
    effect: (player) => {
      player.skillCooldownMultiplier *= 0.5;
      (player as any).thoiGianActive = true;
      (player as any).thoiGianAuraRadius = 200;
    },
    visualOverrides: {
      auraColor: '#6366f1',
      particleEffect: 'time_distortion',
      sizeBonus: 5,
      trailStyle: 'temporal',
    },
  },

  [LegendaryEvolutionId.AmAnh]: {
    id: LegendaryEvolutionId.AmAnh,
    name: 'Ám Ảnh',
    title: 'The Phantom',
    description: 'Tàng hình vĩnh viễn khi di chuyển chậm. Đòn đánh từ tàng hình x3 damage.',
    requiredMutations: [MutationId.Stealth, MutationId.KillingIntent, MutationId.KeenHearing],
    effect: (player) => {
      player.visionMultiplier *= 2;
      (player as any).amAnhActive = true;
    },
    visualOverrides: {
      auraColor: '#1e293b',
      particleEffect: 'shadow_wisps',
      sizeBonus: 0,
      trailStyle: 'shadow',
    },
  },

  // ==================== FACTION-SPECIFIC ====================
  [LegendaryEvolutionId.HoaThan]: {
    id: LegendaryEvolutionId.HoaThan,
    name: 'Hỏa Thần',
    title: 'Fire God',
    description: 'Miễn nhiễm lửa. Để lại vệt lửa khi di chuyển. Skill tạo nova lửa.',
    requiredMutations: [MutationId.KillingIntent, MutationId.DoubleCast],
    factionRequirement: Faction.Fire,
    effect: (player) => {
      player.damageMultiplier *= 1.4;
      (player as any).hoaThanActive = true;
    },
    visualOverrides: {
      auraColor: '#f97316',
      particleEffect: 'fire_nova',
      sizeBonus: 10,
      trailStyle: 'lava',
    },
  },

  [LegendaryEvolutionId.BangVuong]: {
    id: LegendaryEvolutionId.BangVuong,
    name: 'Băng Vương',
    title: 'Ice King',
    description: 'Đóng băng kẻ địch gần trong 2s mỗi 10s. Projectile bắn 5 viên.',
    requiredMutations: [MutationId.Swift, MutationId.DoubleCast],
    factionRequirement: Faction.Water,
    effect: (player) => {
      player.maxSpeed *= 1.3;
      (player as any).bangVuongActive = true;
      (player as any).bangVuongFreezeTimer = 0;
    },
    visualOverrides: {
      auraColor: '#0ea5e9',
      particleEffect: 'blizzard',
      sizeBonus: 8,
      trailStyle: 'frost',
    },
  },

  [LegendaryEvolutionId.ThachThan]: {
    id: LegendaryEvolutionId.ThachThan,
    name: 'Thạch Thần',
    title: 'Stone God',
    description: 'HP x2. Defense x2. Tốc độ -50% nhưng không thể bị knockback.',
    requiredMutations: [MutationId.ThickSkin, MutationId.LightSpikes],
    factionRequirement: Faction.Earth,
    effect: (player) => {
      player.maxHealth *= 2;
      player.currentHealth = player.maxHealth;
      player.defense *= 2;
      player.maxSpeed *= 0.5;
      (player as any).thachThanActive = true;
    },
    visualOverrides: {
      auraColor: '#a16207',
      particleEffect: 'rock_orbit',
      sizeBonus: 20,
      trailStyle: 'stone',
    },
  },

  [LegendaryEvolutionId.MocTinh]: {
    id: LegendaryEvolutionId.MocTinh,
    name: 'Mộc Tinh',
    title: 'Wood Spirit',
    description: 'Hồi máu cực nhanh. Skill tạo vùng hồi máu cho đồng minh (future).',
    requiredMutations: [MutationId.Lifesteal, MutationId.ThickSkin],
    factionRequirement: Faction.Wood,
    effect: (player) => {
      player.lifesteal += 0.4;
      player.maxHealth *= 1.5;
      player.currentHealth = player.maxHealth;
      (player as any).mocTinhActive = true;
      (player as any).mocTinhRegenAura = 150;
    },
    visualOverrides: {
      auraColor: '#22c55e',
      particleEffect: 'nature_bloom',
      sizeBonus: 10,
      trailStyle: 'vine',
    },
  },

  [LegendaryEvolutionId.KimCuong]: {
    id: LegendaryEvolutionId.KimCuong,
    name: 'Kim Cương',
    title: 'Diamond',
    description: 'Damage x2. Dash không có cooldown trong 3s sau kill.',
    requiredMutations: [MutationId.DashBoost, MutationId.KillingIntent],
    factionRequirement: Faction.Metal,
    effect: (player) => {
      player.damageMultiplier *= 2;
      player.skillDashMultiplier *= 2;
      (player as any).kimCuongActive = true;
    },
    visualOverrides: {
      auraColor: '#e2e8f0',
      particleEffect: 'diamond_shards',
      sizeBonus: 5,
      trailStyle: 'metallic',
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if player has all required mutations for an evolution
 */
function hasRequiredMutations(player: Player, evolution: LegendaryEvolution): boolean {
  return evolution.requiredMutations.every((mutId) =>
    player.mutations.includes(mutId)
  );
}

/**
 * Check faction requirement
 */
function matchesFactionRequirement(player: Player, evolution: LegendaryEvolution): boolean {
  if (!evolution.factionRequirement) return true;
  return player.faction === evolution.factionRequirement;
}

/**
 * Check if player qualifies for any legendary evolution
 */
export function checkForLegendaryEvolution(player: Player): LegendaryEvolution | null {
  // Get player's active legendary evolutions
  const activeEvolutions = (player as any).legendaryEvolutions as LegendaryEvolutionId[] || [];

  for (const evolution of Object.values(LEGENDARY_EVOLUTIONS)) {
    // Skip if already has this evolution
    if (activeEvolutions.includes(evolution.id)) continue;

    // Check requirements
    if (!hasRequiredMutations(player, evolution)) continue;
    if (!matchesFactionRequirement(player, evolution)) continue;

    return evolution;
  }

  return null;
}

/**
 * Apply legendary evolution to player
 */
export function applyLegendaryEvolution(player: Player, evolutionId: LegendaryEvolutionId): void {
  const evolution = LEGENDARY_EVOLUTIONS[evolutionId];
  if (!evolution) return;

  // Track active evolutions
  if (!(player as any).legendaryEvolutions) {
    (player as any).legendaryEvolutions = [];
  }
  (player as any).legendaryEvolutions.push(evolutionId);

  // Apply effect
  evolution.effect(player);

  // Apply visual overrides
  (player as any).auraColor = evolution.visualOverrides.auraColor;
  (player as any).particleEffect = evolution.visualOverrides.particleEffect;
  player.radius += evolution.visualOverrides.sizeBonus;
  (player as any).trailStyle = evolution.visualOverrides.trailStyle;

  // Trigger VFX
  vfxManager.triggerLegendaryEvolution(player.position, evolution.name);

  // Play sound
  audioEngine.playLegendary();

  console.log(`[LegendaryEvolution] ${player.name} evolved into ${evolution.name}!`);
}

/**
 * Get all available evolutions for a player
 */
export function getAvailableEvolutions(player: Player): LegendaryEvolution[] {
  const activeEvolutions = (player as any).legendaryEvolutions as LegendaryEvolutionId[] || [];

  return Object.values(LEGENDARY_EVOLUTIONS).filter((evolution) => {
    if (activeEvolutions.includes(evolution.id)) return false;
    if (!matchesFactionRequirement(player, evolution)) return false;
    return true;
  });
}

/**
 * Get progress toward an evolution
 */
export function getEvolutionProgress(player: Player, evolutionId: LegendaryEvolutionId): {
  owned: MutationId[];
  required: MutationId[];
  percentage: number;
} {
  const evolution = LEGENDARY_EVOLUTIONS[evolutionId];
  if (!evolution) {
    return { owned: [], required: [], percentage: 0 };
  }

  const owned = evolution.requiredMutations.filter((mutId) =>
    player.mutations.includes(mutId)
  );

  return {
    owned,
    required: evolution.requiredMutations,
    percentage: (owned.length / evolution.requiredMutations.length) * 100,
  };
}

/**
 * Get display info for UI
 */
export function getLegendaryEvolutionDisplayInfo(id: LegendaryEvolutionId): {
  name: string;
  title: string;
  description: string;
  auraColor: string;
  requiredMutations: MutationId[];
  factionRequirement?: Faction;
} | null {
  const evolution = LEGENDARY_EVOLUTIONS[id];
  if (!evolution) return null;

  return {
    name: evolution.name,
    title: evolution.title,
    description: evolution.description,
    auraColor: evolution.visualOverrides.auraColor,
    requiredMutations: evolution.requiredMutations,
    factionRequirement: evolution.factionRequirement,
  };
}

// ============================================
// EXPORTS
// ============================================

export const ALL_LEGENDARY_EVOLUTIONS = Object.values(LEGENDARY_EVOLUTIONS);
export const LEGENDARY_EVOLUTION_IDS = Object.values(LegendaryEvolutionId);
