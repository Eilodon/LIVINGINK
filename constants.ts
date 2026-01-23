import { Faction } from './types';

// World Settings
export const WORLD_WIDTH = 3400; 
export const WORLD_HEIGHT = 3400;
export const MAP_RADIUS = 1600; 
export const INITIAL_ZONE_RADIUS = 1600;
export const CENTER_RADIUS = 320; 
export const GAME_DURATION = 480; 
export const SPAWN_PROTECTION_TIME = 5;
export const GRID_CELL_SIZE = 300; // Optimization: Spatial Grid Cell Size

// Entity Settings
export const PLAYER_START_RADIUS = 28; 
export const TIER_RADIUS_RANGE = 150;
export const MAX_ENTITY_RADIUS = 155;
export const GROWTH_DECAY_START = 70;
export const GROWTH_DECAY_END = 155;

// PHYSICS 4.0: NEURAL-LINK RESPONSIVENESS
// High Acceleration + High Drag = Snappy Controls
export const TURN_SPEED_BASE = 0.25; // Faster visual turning
export const ACCELERATION_BASE = 1.0; // Smoother control
export const FRICTION_BASE = 0.93; // Less snappy, more glide
export const MAX_SPEED_BASE = 6.8; // Lower top speed for control

export const FOOD_COUNT = 260; 
export const BOT_COUNT = 28; 
export const BOT_RESPAWN_TIME = 20;
export const FOOD_RADIUS = 7;
export const TRAIL_LENGTH = 12; // Shorter trail for cleaner look at high speeds
export const FOOD_GROWTH_MULTIPLIER = 0.08;
export const KILL_GROWTH_MULTIPLIER = 0.16;

// THE HOLY TRINITY RULES
export const EAT_THRESHOLD_RATIO = 0.90; 
export const DANGER_THRESHOLD_RATIO = 1.10; 

// Mechanics
export const EJECT_MASS_COST = 8;
export const EJECT_SPEED = 18;
export const SKILL_COOLDOWN_BASE = 8; 

// Objective: Ancient Relic
export const RELIC_RESPAWN_TIME = 35;
export const RELIC_VALUE = 25;
export const RELIC_RADIUS = 18;
export const RELIC_GROWTH = 3;
export const RELIC_HEAL = 20;
export const RELIC_REGEN = 12;

// King Bounty (Anti-snowball)
export const KING_DAMAGE_TAKEN_MULTIPLIER = 1.15;
export const KING_DAMAGE_DEALT_MULTIPLIER = 0.9;
export const KING_BOUNTY_SCORE = 200;
export const KING_BOUNTY_RADIUS = 4;

// Mutations
export const MUTATION_CHOICES = 3;

// Hazards & Events
export const LIGHTNING_WARNING_TIME = 1.2;
export const LIGHTNING_RADIUS = 80;
export const LIGHTNING_INTERVAL_ROUND_2 = 12;
export const LIGHTNING_INTERVAL_ROUND_3 = 8;
export const LIGHTNING_INTERVAL_ROUND_4 = 4;
export const LIGHTNING_DAMAGE_OUTSIDE = 0.4;
export const LIGHTNING_DAMAGE_INSIDE = 0.2;
export const LIGHTNING_DAMAGE_FINAL = 0.3;

export const GEYSER_INTERVAL = 8;
export const GEYSER_WARNING_TIME = 1.0;
export const GEYSER_DAMAGE = 20;

export const ICICLE_INTERVAL = 10;
export const ICICLE_WARNING_TIME = 1.0;
export const ICICLE_DAMAGE = 15;

export const SPEAR_DAMAGE = 12;
export const SPEAR_COOLDOWN = 6;

export const VINES_SLOW_MULTIPLIER = 0.8;
export const VINES_DURATION = 1.2;

export const THIN_ICE_SLOW_MULTIPLIER = 0.5;
export const THIN_ICE_DURATION = 3;

export const WIND_SPEED_MULTIPLIER = 1.5;

export const MUSHROOM_COOLDOWN = 8;

export const DUST_STORM_INTERVAL = 20;
export const DUST_STORM_DURATION = 6;

// Power-ups
export const FIRE_ORB_DURATION = 20;
export const HEALING_POTION_VALUE = 0.3;
export const ICE_HEART_DURATION = 30;
export const SWORD_AURA_HITS = 5;
export const DIAMOND_SHIELD_VALUE = 50;
export const HEALING_FRUIT_VALUE = 15;

// Creeps & Boss
export const CREEPS_PER_ZONE = 4;
export const ELITE_RESPAWN_TIME = 35;
export const BOSS_RESPAWN_TIME = 90;
export const BOSS_MAX_HEALTH = 220;
export const BOSS_DAMAGE = 20;
export const BOSS_RADIUS = 80;
export const BOSS_ATTACK_INTERVAL = 6;

// Elemental Counters 
export const ELEMENTAL_ADVANTAGE: Record<Faction, Faction> = {
  [Faction.Metal]: Faction.Wood, 
  [Faction.Wood]: Faction.Earth, 
  [Faction.Earth]: Faction.Water, 
  [Faction.Water]: Faction.Fire,  
  [Faction.Fire]: Faction.Metal,  
};

// GDD Color Palette - EXACT HEX CODES & LORE
export const FACTION_CONFIG = {
  [Faction.Fire]: {
    name: 'NHAM HỎA XÍCH CÁP', 
    transformName: 'Cóc Đỏ → Nham Hỏa Xích Cáp',
    color: '#ea580c', // Orange-600
    secondary: '#fed7aa', // Orange-200
    stroke: '#9a3412', // Orange-800
    icon: '🐸',
    desc: 'DOT Mage: Sát thương thiêu đốt, kiểm soát vùng.',
    skillName: 'Nham Phún',
    stats: { 
      speed: 0.9,      // Slow
      health: 1.1,     // Medium HP
      damage: 1.2,     // High damage (burn)
      defense: 1.0 
    }
  },
  [Faction.Earth]: {
    name: 'KIM CANG ĐỘC HẠT', 
    transformName: 'Bò Cạp → Kim Cang Độc Hạt',
    color: '#713f12', // Yellow-900 (Brownish)
    secondary: '#fde047', // Yellow-300
    stroke: '#422006',
    icon: '🦂',
    desc: 'Tank: Giáp siêu dày, phản sát thương.',
    skillName: 'Đuôi Quật',
    stats: { 
      speed: 0.7,      // Slowest
      health: 1.6,     // Highest HP
      damage: 0.8,     // Low damage
      defense: 1.5     // Highest defense
    }
  },
  [Faction.Metal]: {
    name: 'BẠO VŨ THIẾT PHONG', 
    transformName: 'Ong Vàng → Bạo Vũ Thiết Phong',
    color: '#e2e8f0', // Slate-200 (Silver)
    secondary: '#3b82f6', // Blue-500
    stroke: '#475569',
    icon: '🐝', 
    desc: 'Assassin: Sát thương chí mạng, áp sát nhanh.',
    skillName: 'Liên Châm',
    stats: { 
      speed: 1.3,      // Fast
      health: 0.8,     // Low HP (glass cannon)
      damage: 1.4,     // Highest damage
      defense: 0.7     // Low defense
    }
  },
  [Faction.Wood]: {
    name: 'THANH PHƯỢC YÊU XÀ', 
    transformName: 'Rắn Lục → Thanh Phược Yêu Xà',
    color: '#16a34a', // Green-600
    secondary: '#86efac', // Green-300
    stroke: '#14532d',
    icon: '🐍',
    desc: 'Sustain: Hồi máu, trói buộc, kháng phép.',
    skillName: 'Quấn Siết',
    stats: { 
      speed: 1.0,      // Medium
      health: 1.3,     // High HP
      damage: 0.9,     // Medium damage
      defense: 1.2     // Good defense
    }
  },
  [Faction.Water]: {
    name: 'HÀN BĂNG CỔ TẰM', 
    transformName: 'Tằm Xanh → Hàn Băng Cổ Tằm',
    color: '#0ea5e9', // Sky-500
    secondary: '#e0f2fe', // Sky-100
    stroke: '#0369a1',
    icon: '🐛',
    desc: 'Speed Demon: Tốc độ tối thượng, làm chậm diện rộng.',
    skillName: 'Tơ Băng',
    stats: { 
      speed: 1.5,      // Fastest!
      health: 0.75,    // Lowest HP
      damage: 1.0,     // Medium damage
      defense: 0.8     // Low defense
    }
  },
};

export const COLOR_PALETTE = {
  background: '#020617', // Void color
  grid: 'rgba(255,255,255,0.05)',
  zone: 'rgba(20, 0, 20, 0.5)', 
  zoneBorder: '#ef4444',
  text: '#ffffff',
  indicatorSafe: '#22c55e', 
  indicatorDanger: '#ef4444', 
  indicatorCombat: '#eab308', 
  indicatorCounter: '#3b82f6', 
  indicatorCountered: '#f97316', 
};
