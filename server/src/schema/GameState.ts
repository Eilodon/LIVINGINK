
/**
 * CJR MULTIPLAYER SERVER - STATE SCHEMA
 * Authoritative State
 */

import { Schema, type, MapSchema, ArraySchema, filter } from '@colyseus/schema';

// ============================================
// SUB-SCHEMAS
// ============================================

export class Vector2 extends Schema {
  @type('float32') x: number = 0;
  @type('float32') y: number = 0;
}

export class PigmentVec3 extends Schema {
  @type('float32') r: number = 0.5;
  @type('float32') g: number = 0.5;
  @type('float32') b: number = 0.5;
}

export class StatusEffects extends Schema {
  @type('float32') speedBoost: number = 1;
  @type('boolean') shielded: boolean = false;
  @type('boolean') burning: boolean = false; // Keep generic debuffs?
  @type('boolean') slowed: boolean = false;
  @type('float32') invulnerable: number = 0;
  @type('float32') damageBoost: number = 1;
  @type('float32') defenseBoost: number = 1;
  // CJR Specific
  @type('float32') commitShield: number = 0;
  @type('float32') pityBoost: number = 0;
}

// ============================================
// ENTITY SCHEMAS
// ============================================

export class PlayerState extends Schema {
  @type('string') id: string = '';
  @type('string') sessionId: string = '';
  @type('string') name: string = 'Jelly';
  @type('string') shape: string = 'circle'; // circle, square, triangle, hex

  // CJR Fields
  @type(PigmentVec3) pigment = new PigmentVec3();
  @type(PigmentVec3) targetPigment = new PigmentVec3();
  @type('float32') matchPercent: number = 0;
  @type('int8') ring: number = 1;
  @type('string') emotion: string = 'happy';

  // Position & Physics
  @type(Vector2) position = new Vector2();
  @type(Vector2) velocity = new Vector2();
  @type('float32') radius: number = 28;

  // Stats
  @type('float32') maxHealth: number = 100;
  @type('float32') currentHealth: number = 100;
  @type('int32') score: number = 0;
  @type('int16') kills: number = 0;
  @type('float32') skillCooldown: number = 0;
  @type('int32')
  @filter(function (this: PlayerState, client: any, value: any, root: any) {
    return client.sessionId === this.sessionId;
  })
  lastProcessedInput: number = 0;

  // State flags
  @type('boolean') isDead: boolean = false;
  @type('boolean') isInvulnerable: boolean = true;

  @type(StatusEffects) statusEffects = new StatusEffects();

  // Tattoos (stored as string IDs)
  @type(['string']) tattoos = new ArraySchema<string>();

  // Trail - Removed for bandwidth optimization (Client-side only)

}

export class BotState extends PlayerState {
  @type('string') aiState: string = 'wander';
  @type('string') personality: string = 'farmer';
  @type('boolean') isBoss: boolean = false;
}

export class FoodState extends Schema {
  @type('string') id: string = '';
  @type('float32') x: number = 0;
  @type('float32') y: number = 0;
  @type('float32') radius: number = 7;
  @type('int8') value: number = 1;
  @type('string') kind: string = 'pigment'; // kind: PickupKind
  @type(PigmentVec3) pigment = new PigmentVec3();
  @type('boolean') isDead: boolean = false;
}

export class ProjectileState extends Schema {
  @type('string') id: string = '';
  @type('string') ownerId: string = '';
  @type('string') type: string = 'ice';
  @type('float32') x: number = 0;
  @type('float32') y: number = 0;
  @type('float32') vx: number = 0;
  @type('float32') vy: number = 0;
  @type('float32') damage: number = 10;
}

// ============================================
// MAIN GAME STATE
// ============================================

export class GameRoomState extends Schema {
  // World info
  @type('float32') worldWidth: number = 3400;
  @type('float32') worldHeight: number = 3400;
  @type('float32') gameTime: number = 0;

  // Entities
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: BotState }) bots = new MapSchema<BotState>();
  @type({ map: FoodState }) food = new MapSchema<FoodState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();

  // Events
  @type(['string']) vfxEvents = new ArraySchema<string>();

  // Leaderboard
  @type(['string']) leaderboard = new ArraySchema<string>();
}
