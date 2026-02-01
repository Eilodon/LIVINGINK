import { Vector2 } from './shared';
export type { Vector2 }; // Re-export for player.ts import compatibility

// For systems that should only READ position
export type ReadonlyPosition = Readonly<{ x: number; y: number }>;

// For systems that can WRITE position (only PhysicsWorld)
export type WritablePosition = { x: number; y: number };

export interface Entity {
  id: string;
  /**
   * Entity position in world coordinates.
   *
   * OWNERSHIP MODEL (EIDOLON-V):
   * - WRITE: Only PhysicsWorld.syncBodiesToBatch() may modify
   * - READ: All other systems read only
   *
   * LIFECYCLE:
   * 1. Birth: factories.ts creates initial position
   * 2. Update: PhysicsWorld applies velocity each frame
   * 3. Constrain: PhysicsWorld clamps to world bounds
   * 4. Death: Position becomes invalid when isDead=true
   */
  position: Vector2;
  velocity: Vector2;
  radius: number; // Represents Mass/Size
  color: number; // 0xRRGGBB Integer
  isDead: boolean;

  // EIDOLON-V: The Link to God-Speed
  // If undefined, entity is purely cosmetic/logic-less
  physicsIndex?: number;

  // Spatial Hashing Cache
  isStatic?: boolean;
  lastCellHash?: number;
}

import { PickupKind, PigmentVec3 } from '../game/cjr/cjrTypes';

export interface Food extends Entity {
  value: number;
  isEjected?: boolean;
  kind: PickupKind; // CJR specific
  pigment?: PigmentVec3; // For pigment/candy_vein
}

export interface Projectile extends Entity {
  ownerId: string;
  damage: number;
  type: 'web' | 'ice' | 'sting'; // Keep for now as skill effects
  duration: number;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  style?: 'dot' | 'ring' | 'line';
  lineLength?: number;
  lineWidth?: number;
  angle?: number;

  // Synergy pattern effects
  isSynergyFusion?: boolean;
  fusionColor?: string;
  isSynergyExplosion?: boolean;
  explosionColor?: string;
  isSynergySpiral?: boolean;
  spiralColor?: string;
  isSynergyGeometric?: boolean;
  geometricSides?: number;
  geometricRadius?: number;
  rotationSpeed?: number;
  geometricColor?: string;

  // Additional synergy effects
  isSynergyEffect?: boolean;
  synergyColor?: string;
}

export interface FloatingText {
  id: string;
  position: Vector2;
  text: string;
  color: string;
  size: number;
  life: number;
  velocity: Vector2;
}

export interface DelayedAction {
  id: string;
  type: 'dash' | 'blast' | 'shield'; // Simplified
  timer: number;
  ownerId: string;
  data?: any;
}
