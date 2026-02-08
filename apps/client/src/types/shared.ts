import type {
  PigmentVec3,
  RingId,
  Emotion,
  ShapeId,
  PickupKind,
  TattooId,
} from '../game/cjr/cjrTypes';

export type { PigmentVec3, RingId, PickupKind, TattooId };
export type { Emotion, ShapeId };

// Export unused enums for future use
export enum GamePhase {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum SizeTier {
  Larva = 'Ấu Trùng', // 0-20%
  Juvenile = 'Thiếu Niên', // 20-40%
  Adult = 'Thanh Niên', // 40-60%
  Elder = 'Trung Niên', // 60-80%
  AncientKing = 'Cổ Vương', // 80-100%
}

export enum MutationTier {
  Common = 'common',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface GameEngineConfig {
  targetFPS: number;
  fixedDeltaTime: number;
  maxFrameTime: number;
  enableInputBuffering: boolean;
  enableObjectPooling: boolean;
  enableSpatialOptimization: boolean;
}

export interface EngineStats {
  fps: number;
  frameTime: number;
  entityCount: number;
  pooledObjects: number;
  memoryUsage: number;
  inputEvents: number;
}
