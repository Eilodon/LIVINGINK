/**
 * GU-KING BLOODLINE SYSTEM
 *
 * Character selection system with unique passives
 * Each bloodline provides:
 * - Locked faction
 * - Unique passive ability
 * - Starting stat modifications
 * - Visual customization
 *
 * Inspired by: Hades boons, Risk of Rain 2 characters, Vampire Survivors characters
 */

import { Faction, Player, MutationId } from '../types';
import { FACTION_CONFIG } from '../constants';

// ============================================
// TYPES
// ============================================

export enum BloodlineId {
  // Fire Bloodlines
  HoaDiemVuong = 'hoa_diem_vuong',       // Fire - DOT Master
  HoaLinh = 'hoa_linh',                   // Fire - Burst Damage

  // Metal Bloodlines
  ThietGiapThan = 'thiet_giap_than',     // Metal - Assassin
  KimLoi = 'kim_loi',                     // Metal - Lightning Speed

  // Water Bloodlines
  BangTamVuong = 'bang_tam_vuong',       // Water - Kiting DPS
  ThuyLong = 'thuy_long',                 // Water - Control

  // Wood Bloodlines
  CoThuTinh = 'co_thu_tinh',             // Wood - Sustain Tank
  MocDu = 'moc_du',                       // Wood - Drain Life

  // Earth Bloodlines
  ThoLongHoang = 'tho_long_hoang',       // Earth - Counter Tank
  ThachDia = 'thach_dia',                 // Earth - Immovable
}

export interface BloodlinePassive {
  id: string;
  name: string;
  description: string;
  trigger: 'on_hit' | 'on_kill' | 'on_damage_taken' | 'on_skill' | 'passive' | 'on_low_hp' | 'on_combat_start';
  effect: (player: Player, context?: any) => void;
  condition?: (player: Player, context?: any) => boolean;
}

export interface BloodlineStats {
  speedMultiplier: number;
  healthMultiplier: number;
  damageMultiplier: number;
  defenseMultiplier: number;
  regenMultiplier: number;
  skillCooldownMultiplier: number;
  growthMultiplier: number;
}

export interface Bloodline {
  id: BloodlineId;
  name: string;
  title: string;
  faction: Faction;
  icon: string;
  description: string;
  lore: string;
  passive: BloodlinePassive;
  stats: BloodlineStats;
  startingMutation?: MutationId;
  visualOverrides?: {
    trailColor?: string;
    glowColor?: string;
    particleStyle?: string;
  };
  unlockRequirement?: {
    gamesPlayed?: number;
    totalKills?: number;
    highScore?: number;
  };
}

// ============================================
// DEFAULT STATS
// ============================================

const DEFAULT_STATS: BloodlineStats = {
  speedMultiplier: 1,
  healthMultiplier: 1,
  damageMultiplier: 1,
  defenseMultiplier: 1,
  regenMultiplier: 1,
  skillCooldownMultiplier: 1,
  growthMultiplier: 1,
};

// ============================================
// BLOODLINE DEFINITIONS
// ============================================

export const BLOODLINES: Record<BloodlineId, Bloodline> = {
  // ==================== FIRE ====================
  [BloodlineId.HoaDiemVuong]: {
    id: BloodlineId.HoaDiemVuong,
    name: 'Hỏa Diệm Vương',
    title: 'Chúa Tể Lửa Thiêng',
    faction: Faction.Fire,
    icon: '🔥',
    description: '+30% sát thương cháy, -10% máu tối đa. Đốt cháy kẻ địch khi đánh.',
    lore: 'Hậu duệ của Hỏa Đế, mang trong mình ngọn lửa vĩnh cửu không bao giờ tắt.',
    passive: {
      id: 'burn_master',
      name: 'Phần Thiên Hỏa',
      description: 'Mỗi đòn đánh gây thêm 30% sát thương dưới dạng cháy trong 3 giây.',
      trigger: 'on_hit',
      effect: (player, context) => {
        if (context?.target) {
          const burnDamage = (context.damage || 10) * 0.3;
          context.target.statusEffects.burning = true;
          context.target.statusEffects.burnTimer = Math.max(
            context.target.statusEffects.burnTimer || 0,
            3
          );
          // Store burn DPS
          context.extraDamageOverTime = burnDamage;
        }
      },
    },
    stats: {
      ...DEFAULT_STATS,
      healthMultiplier: 0.9,
      damageMultiplier: 1.3,
    },
    visualOverrides: {
      trailColor: '#f97316',
      glowColor: '#ea580c',
      particleStyle: 'embers',
    },
  },

  [BloodlineId.HoaLinh]: {
    id: BloodlineId.HoaLinh,
    name: 'Hỏa Linh',
    title: 'Linh Hồn Lửa',
    faction: Faction.Fire,
    icon: '💥',
    description: 'Skill gây 2x sát thương nhưng cooldown +50%. Miễn nhiễm cháy.',
    lore: 'Một linh hồn lửa thuần khiết, tích tụ sức mạnh để giải phóng trong khoảnh khắc.',
    passive: {
      id: 'burst_flame',
      name: 'Bùng Nổ',
      description: 'Kỹ năng gây gấp đôi sát thương.',
      trigger: 'on_skill',
      effect: (player, context) => {
        if (context?.skillDamage) {
          context.skillDamage *= 2;
        }
      },
    },
    stats: {
      ...DEFAULT_STATS,
      damageMultiplier: 1.1,
      skillCooldownMultiplier: 1.5,
    },
    unlockRequirement: {
      gamesPlayed: 5,
    },
  },

  // ==================== METAL ====================
  [BloodlineId.ThietGiapThan]: {
    id: BloodlineId.ThietGiapThan,
    name: 'Thiết Giáp Thần',
    title: 'Sát Thủ Bóng Đêm',
    faction: Faction.Metal,
    icon: '⚔️',
    description: 'Đòn đánh đầu tiên mỗi combat luôn chí mạng. +40% sát thương, -20% máu.',
    lore: 'Kẻ ám sát hoàn hảo, một đòn chí mạng là tất cả những gì cần.',
    passive: {
      id: 'first_strike',
      name: 'Nhất Kích Tất Sát',
      description: 'Đòn đánh đầu tiên trong mỗi trận chiến luôn chí mạng (x2 damage).',
      trigger: 'on_combat_start',
      effect: (player) => {
        player.statusEffects.critCharges = 1;
      },
    },
    stats: {
      ...DEFAULT_STATS,
      damageMultiplier: 1.4,
      healthMultiplier: 0.8,
      speedMultiplier: 1.1,
    },
    visualOverrides: {
      trailColor: '#94a3b8',
      glowColor: '#e2e8f0',
      particleStyle: 'sparks',
    },
  },

  [BloodlineId.KimLoi]: {
    id: BloodlineId.KimLoi,
    name: 'Kim Lôi',
    title: 'Tia Chớp Kim Loại',
    faction: Faction.Metal,
    icon: '⚡',
    description: '+50% tốc độ, dash đi xuyên kẻ địch và gây sát thương.',
    lore: 'Nhanh như chớp, sắc như kiếm. Không ai thấy hắn đến, chỉ thấy xác chết để lại.',
    passive: {
      id: 'lightning_dash',
      name: 'Lôi Tốc',
      description: 'Dash xuyên qua kẻ địch, gây 15 sát thương cho mỗi kẻ bị xuyên qua.',
      trigger: 'on_skill',
      effect: (player, context) => {
        if (context?.dashPath) {
          context.dashDamageEnabled = true;
          context.dashDamage = 15;
        }
      },
    },
    stats: {
      ...DEFAULT_STATS,
      speedMultiplier: 1.5,
      healthMultiplier: 0.7,
    },
    unlockRequirement: {
      totalKills: 50,
    },
  },

  // ==================== WATER ====================
  [BloodlineId.BangTamVuong]: {
    id: BloodlineId.BangTamVuong,
    name: 'Băng Tâm Vương',
    title: 'Vương Giả Băng Giá',
    faction: Faction.Water,
    icon: '❄️',
    description: 'Bắn 3 viên đạn băng thay vì 1. Làm chậm kẻ địch khi đánh.',
    lore: 'Trái tim lạnh như băng, mỗi hơi thở mang theo sương giá chết người.',
    passive: {
      id: 'triple_ice',
      name: 'Tam Băng Tiễn',
      description: 'Kỹ năng bắn 3 viên đạn băng thay vì 1.',
      trigger: 'on_skill',
      effect: (player, context) => {
        if (context?.projectileCount !== undefined) {
          context.projectileCount = 3;
          context.projectileSpread = 15; // degrees
        }
      },
    },
    stats: {
      ...DEFAULT_STATS,
      speedMultiplier: 1.3,
      healthMultiplier: 0.85,
    },
    visualOverrides: {
      trailColor: '#0ea5e9',
      glowColor: '#38bdf8',
      particleStyle: 'frost',
    },
  },

  [BloodlineId.ThuyLong]: {
    id: BloodlineId.ThuyLong,
    name: 'Thủy Long',
    title: 'Rồng Nước Thái Cổ',
    faction: Faction.Water,
    icon: '🐉',
    description: 'Tạo vùng nước quanh mình, làm chậm kẻ địch 30%. Hồi máu trong vùng nước.',
    lore: 'Con cháu của Thủy Long, mang sức mạnh kiểm soát nước và thời gian.',
    passive: {
      id: 'water_domain',
      name: 'Thủy Vực',
      description: 'Tạo vùng nước bán kính 100 quanh mình, làm chậm kẻ địch 30%.',
      trigger: 'passive',
      effect: (player) => {
        // Applied in game loop - creates slowing aura
        player.magneticFieldRadius = Math.max(player.magneticFieldRadius, 100);
      },
      condition: (player) => !player.isDead,
    },
    stats: {
      ...DEFAULT_STATS,
      healthMultiplier: 1.1,
      regenMultiplier: 1.5,
      speedMultiplier: 1.2,
    },
    unlockRequirement: {
      gamesPlayed: 10,
    },
  },

  // ==================== WOOD ====================
  [BloodlineId.CoThuTinh]: {
    id: BloodlineId.CoThuTinh,
    name: 'Cổ Thụ Tinh',
    title: 'Tinh Linh Cổ Thụ',
    faction: Faction.Wood,
    icon: '🌳',
    description: '+50% hồi máu khi HP < 30%. Miễn nhiễm độc.',
    lore: 'Linh hồn của cổ thụ ngàn năm, sức sống mãnh liệt không gì có thể dập tắt.',
    passive: {
      id: 'ancient_vitality',
      name: 'Sinh Mệnh Cổ Thụ',
      description: 'Khi HP dưới 30%, hồi máu tăng 50%.',
      trigger: 'on_low_hp',
      effect: (player) => {
        player.statusEffects.regen = Math.max(
          player.statusEffects.regen,
          player.maxHealth * 0.05
        );
      },
      condition: (player) => player.currentHealth / player.maxHealth < 0.3,
    },
    stats: {
      ...DEFAULT_STATS,
      healthMultiplier: 1.3,
      defenseMultiplier: 1.2,
      regenMultiplier: 1.5,
    },
    visualOverrides: {
      trailColor: '#22c55e',
      glowColor: '#4ade80',
      particleStyle: 'leaves',
    },
  },

  [BloodlineId.MocDu]: {
    id: BloodlineId.MocDu,
    name: 'Mộc Dữ',
    title: 'Cây Ma Ăn Thịt',
    faction: Faction.Wood,
    icon: '🌿',
    description: 'Hút 25% sát thương gây ra thành máu. Skill kéo kẻ địch về phía mình.',
    lore: 'Một loài thực vật ăn thịt tiến hóa, nuốt chửng mọi sinh vật.',
    passive: {
      id: 'life_drain',
      name: 'Hấp Sinh',
      description: 'Hồi 25% sát thương gây ra dưới dạng máu.',
      trigger: 'on_hit',
      effect: (player, context) => {
        if (context?.damage) {
          const healAmount = context.damage * 0.25;
          player.currentHealth = Math.min(
            player.maxHealth,
            player.currentHealth + healAmount
          );
        }
      },
    },
    stats: {
      ...DEFAULT_STATS,
      damageMultiplier: 1.1,
      healthMultiplier: 1.1,
      lifesteal: 0.25,
    },
    startingMutation: MutationId.Lifesteal,
    unlockRequirement: {
      totalKills: 100,
    },
  },

  // ==================== EARTH ====================
  [BloodlineId.ThoLongHoang]: {
    id: BloodlineId.ThoLongHoang,
    name: 'Thổ Long Hoàng',
    title: 'Hoàng Đế Đất',
    faction: Faction.Earth,
    icon: '🛡️',
    description: 'Phản 25% sát thương cận chiến. +50% giáp, -30% tốc độ.',
    lore: 'Vua của vương quốc dưới lòng đất, lớp vảy cứng như kim cương.',
    passive: {
      id: 'thorns',
      name: 'Gai Độc',
      description: 'Phản lại 25% sát thương cận chiến cho kẻ tấn công.',
      trigger: 'on_damage_taken',
      effect: (player, context) => {
        if (context?.attacker && context?.damage && context?.isMelee) {
          const reflectDamage = context.damage * 0.25;
          context.reflectDamage = reflectDamage;
        }
      },
    },
    stats: {
      ...DEFAULT_STATS,
      defenseMultiplier: 1.5,
      healthMultiplier: 1.4,
      speedMultiplier: 0.7,
    },
    visualOverrides: {
      trailColor: '#a16207',
      glowColor: '#ca8a04',
      particleStyle: 'rocks',
    },
  },

  [BloodlineId.ThachDia]: {
    id: BloodlineId.ThachDia,
    name: 'Thạch Địa',
    title: 'Tượng Đá Bất Diệt',
    faction: Faction.Earth,
    icon: '🗿',
    description: 'Không thể bị đẩy lùi. Đứng yên 2s để +100% phòng thủ trong 5s.',
    lore: 'Một sinh vật đá cổ đại, bất động như núi, vững chãi như đất.',
    passive: {
      id: 'immovable',
      name: 'Bất Động',
      description: 'Miễn nhiễm knockback. Đứng yên 2s để tăng 100% phòng thủ.',
      trigger: 'passive',
      effect: (player) => {
        // Knockback immunity is handled in physics
        if (player.stationaryTime >= 2) {
          player.statusEffects.defenseBoost = Math.max(
            player.statusEffects.defenseBoost,
            2
          );
          player.statusEffects.defenseBoostTimer = 5;
        }
      },
      condition: (player) => player.stationaryTime >= 2,
    },
    stats: {
      ...DEFAULT_STATS,
      defenseMultiplier: 1.6,
      healthMultiplier: 1.5,
      speedMultiplier: 0.6,
      damageMultiplier: 0.8,
    },
    unlockRequirement: {
      highScore: 500,
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get bloodline by ID
 */
export function getBloodline(id: BloodlineId): Bloodline | null {
  return BLOODLINES[id] || null;
}

/**
 * Get all bloodlines for a faction
 */
export function getBloodlinesByFaction(faction: Faction): Bloodline[] {
  return Object.values(BLOODLINES).filter((b) => b.faction === faction);
}

/**
 * Get all unlocked bloodlines based on profile
 */
export function getUnlockedBloodlines(profile: {
  gamesPlayed: number;
  totalKills: number;
  highScore: number;
}): Bloodline[] {
  return Object.values(BLOODLINES).filter((bloodline) => {
    if (!bloodline.unlockRequirement) return true;

    const req = bloodline.unlockRequirement;
    if (req.gamesPlayed && profile.gamesPlayed < req.gamesPlayed) return false;
    if (req.totalKills && profile.totalKills < req.totalKills) return false;
    if (req.highScore && profile.highScore < req.highScore) return false;

    return true;
  });
}

/**
 * Check if a bloodline is unlocked
 */
export function isBloodlineUnlocked(
  id: BloodlineId,
  profile: { gamesPlayed: number; totalKills: number; highScore: number }
): boolean {
  const bloodline = BLOODLINES[id];
  if (!bloodline) return false;
  if (!bloodline.unlockRequirement) return true;

  const req = bloodline.unlockRequirement;
  if (req.gamesPlayed && profile.gamesPlayed < req.gamesPlayed) return false;
  if (req.totalKills && profile.totalKills < req.totalKills) return false;
  if (req.highScore && profile.highScore < req.highScore) return false;

  return true;
}

/**
 * Apply bloodline stats to player
 */
export function applyBloodlineStats(player: Player, bloodlineId: BloodlineId): void {
  const bloodline = BLOODLINES[bloodlineId];
  if (!bloodline) return;

  const stats = bloodline.stats;

  player.maxSpeed *= stats.speedMultiplier;
  player.maxHealth *= stats.healthMultiplier;
  player.currentHealth = player.maxHealth;
  player.damageMultiplier *= stats.damageMultiplier;
  player.defense *= stats.defenseMultiplier;
  player.maxSkillCooldown *= stats.skillCooldownMultiplier;
  player.killGrowthMultiplier *= stats.growthMultiplier;

  // Apply starting mutation if any
  if (bloodline.startingMutation) {
    if (!player.mutations.includes(bloodline.startingMutation)) {
      player.mutations.push(bloodline.startingMutation);
    }
  }

  // Apply lifesteal if defined
  if (stats.lifesteal) {
    player.lifesteal += stats.lifesteal;
  }
}

/**
 * Trigger bloodline passive
 */
export function triggerBloodlinePassive(
  player: Player,
  bloodlineId: BloodlineId,
  trigger: BloodlinePassive['trigger'],
  context?: any
): any {
  const bloodline = BLOODLINES[bloodlineId];
  if (!bloodline) return context;

  const passive = bloodline.passive;
  if (passive.trigger !== trigger) return context;

  // Check condition if exists
  if (passive.condition && !passive.condition(player, context)) {
    return context;
  }

  // Apply effect
  passive.effect(player, context);

  return context;
}

/**
 * Get bloodline display info for UI
 */
export function getBloodlineDisplayInfo(id: BloodlineId): {
  name: string;
  title: string;
  icon: string;
  faction: Faction;
  factionColor: string;
  description: string;
  passiveName: string;
  passiveDescription: string;
} | null {
  const bloodline = BLOODLINES[id];
  if (!bloodline) return null;

  const factionConfig = FACTION_CONFIG[bloodline.faction];

  return {
    name: bloodline.name,
    title: bloodline.title,
    icon: bloodline.icon,
    faction: bloodline.faction,
    factionColor: factionConfig?.color || '#ffffff',
    description: bloodline.description,
    passiveName: bloodline.passive.name,
    passiveDescription: bloodline.passive.description,
  };
}

// ============================================
// EXPORTS
// ============================================

export const ALL_BLOODLINES = Object.values(BLOODLINES);
export const BLOODLINE_IDS = Object.values(BloodlineId);
