/**
 * GU-KING MULTIPLAYER SERVER - STATE SCHEMA
 *
 * Colyseus Schema for efficient delta synchronization
 * Based on best practices from Agar.io, Slither.io server architectures
 */

import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

// ============================================
// ENUMS (mirroring client types)
// ============================================

export enum Faction {
  Metal = 'Kim',
  Wood = 'Moc',
  Water = 'Thuy',
  Fire = 'Hoa',
  Earth = 'Tho',
}

export enum SizeTier {
  Larva = 'Ấu Trùng',
  Juvenile = 'Thiếu Niên',
  Adult = 'Thanh Niên',
  Elder = 'Trung Niên',
  AncientKing = 'Cổ Vương',
}

export enum BloodlineId {
  HoaDiemVuong = 'hoa_diem_vuong',
  ThietGiapThan = 'thiet_giap_than',
  BangTamVuong = 'bang_tam_vuong',
  CoThuTinh = 'co_thu_tinh',
  ThoLongHoang = 'tho_long_hoang',
}

// ============================================
// SUB-SCHEMAS
// ============================================

export class Vector2 extends Schema {
  @type('float32') x: number = 0;
  @type('float32') y: number = 0;
}

export class StatusEffects extends Schema {
  @type('float32') speedBoost: number = 1;
  @type('float32') speedBoostTimer: number = 0;
  @type('boolean') shielded: boolean = false;
  @type('float32') shieldTimer: number = 0;
  @type('boolean') burning: boolean = false;
  @type('float32') burnTimer: number = 0;
  @type('boolean') slowed: boolean = false;
  @type('float32') slowTimer: number = 0;
  @type('float32') slowMultiplier: number = 1;
  @type('boolean') poisoned: boolean = false;
  @type('float32') poisonTimer: number = 0;
  @type('float32') regen: number = 0;
  @type('boolean') airborne: boolean = false;
  @type('boolean') stealthed: boolean = false;
  @type('float32') stealthCharge: number = 0;
  @type('float32') invulnerable: number = 0;
  @type('float32') rooted: number = 0;
  @type('float32') damageFlash: number = 0;
  @type('float32') kingForm: number = 0;
  @type('float32') damageBoost: number = 1;
  @type('float32') defenseBoost: number = 1;
}

// ============================================
// ENTITY SCHEMAS
// ============================================

export class PlayerState extends Schema {
  @type('string') id: string = '';
  @type('string') sessionId: string = '';
  @type('string') name: string = '';
  @type('string') faction: string = Faction.Fire;
  @type('string') bloodline: string = BloodlineId.HoaDiemVuong;
  @type('string') tier: string = SizeTier.Larva;

  // Position & Physics
  @type(Vector2) position = new Vector2();
  @type(Vector2) velocity = new Vector2();
  @type(Vector2) targetPosition = new Vector2();
  @type('float32') radius: number = 28;

  // Stats
  @type('float32') maxHealth: number = 100;
  @type('float32') currentHealth: number = 100;
  @type('int32') score: number = 0;
  @type('int16') kills: number = 0;
  @type('float32') skillCooldown: number = 0;
  @type('float32') maxSkillCooldown: number = 8;

  // State flags
  @type('boolean') isDead: boolean = false;
  @type('boolean') isInvulnerable: boolean = true;
  @type('float32') spawnTime: number = 0;

  // Combat stats
  @type('float32') defense: number = 1;
  @type('float32') damageMultiplier: number = 1;
  @type('float32') lifesteal: number = 0;
  @type('float32') armorPen: number = 0;
  @type('float32') reflectDamage: number = 0;

  // Status effects (embedded)
  @type(StatusEffects) statusEffects = new StatusEffects();

  // Mutations (as string array for simplicity)
  @type(['string']) mutations = new ArraySchema<string>();

  // Trail positions for rendering (last 12 positions)
  @type([Vector2]) trail = new ArraySchema<Vector2>();

  // Soul Essence (new mechanic)
  @type('int32') soulEssence: number = 0;
  @type('int8') mutationSlots: number = 1;
}

export class BotState extends Schema {
  @type('string') id: string = '';
  @type('string') faction: string = Faction.Fire;
  @type('string') tier: string = SizeTier.Larva;
  @type('string') aiState: string = 'wander';

  @type(Vector2) position = new Vector2();
  @type(Vector2) velocity = new Vector2();
  @type('float32') radius: number = 28;

  @type('float32') maxHealth: number = 100;
  @type('float32') currentHealth: number = 100;
  @type('boolean') isDead: boolean = false;
  @type('boolean') isInvulnerable: boolean = true;

  @type('boolean') isCreep: boolean = false;
  @type('boolean') isElite: boolean = false;
  @type('boolean') isBoss: boolean = false;

  @type(StatusEffects) statusEffects = new StatusEffects();
  @type([Vector2]) trail = new ArraySchema<Vector2>();
}

export class FoodState extends Schema {
  @type('string') id: string = '';
  @type('float32') x: number = 0;
  @type('float32') y: number = 0;
  @type('float32') radius: number = 7;
  @type('int8') value: number = 1;
  @type('string') kind: string = 'normal'; // normal, ejected, relic
  @type('boolean') isDead: boolean = false;
}

export class ProjectileState extends Schema {
  @type('string') id: string = '';
  @type('string') ownerId: string = '';
  @type('string') type: string = 'ice'; // web, ice, sting
  @type('float32') x: number = 0;
  @type('float32') y: number = 0;
  @type('float32') vx: number = 0;
  @type('float32') vy: number = 0;
  @type('float32') damage: number = 10;
  @type('float32') duration: number = 2;
}

export class HazardState extends Schema {
  @type('string') id: string = '';
  @type('string') type: string = 'lightning';
  @type('float32') x: number = 0;
  @type('float32') y: number = 0;
  @type('float32') radius: number = 80;
  @type('float32') timer: number = 0;
  @type('boolean') active: boolean = false;
}

export class PowerUpState extends Schema {
  @type('string') id: string = '';
  @type('string') type: string = 'fire_orb';
  @type('float32') x: number = 0;
  @type('float32') y: number = 0;
  @type('boolean') isDead: boolean = false;
}

export class LavaZoneState extends Schema {
  @type('string') id: string = '';
  @type('float32') x: number = 0;
  @type('float32') y: number = 0;
  @type('float32') radius: number = 60;
  @type('float32') damage: number = 5;
  @type('float32') life: number = 3;
}

// ============================================
// MAIN GAME STATE
// ============================================

export class GameRoomState extends Schema {
  // World info
  @type('float32') worldWidth: number = 3400;
  @type('float32') worldHeight: number = 3400;
  @type('float32') zoneRadius: number = 1600;
  @type('float32') gameTime: number = 0;
  @type('int8') currentRound: number = 1;
  @type('string') kingId: string = '';
  @type('string') relicId: string = '';

  // Server tick info (for client interpolation)
  @type('uint32') serverTick: number = 0;
  @type('float64') serverTime: number = 0;

  // Entities (MapSchema for efficient delta sync)
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: BotState }) bots = new MapSchema<BotState>();
  @type({ map: FoodState }) food = new MapSchema<FoodState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
  @type({ map: HazardState }) hazards = new MapSchema<HazardState>();
  @type({ map: PowerUpState }) powerUps = new MapSchema<PowerUpState>();
  @type({ map: LavaZoneState }) lavaZones = new MapSchema<LavaZoneState>();

  // Events for VFX (cleared each tick)
  @type(['string']) vfxEvents = new ArraySchema<string>();

  // Leaderboard (top 10 player IDs sorted by score)
  @type(['string']) leaderboard = new ArraySchema<string>();
}
