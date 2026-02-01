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

export enum GamePhase {
  Menu = 'MENU',
  Playing = 'PLAYING',
  GameOver = 'GAME_OVER',
}

export enum SizeTier {
  Larva = 'Ấu Trùng', // 0-20%
  Juvenile = 'Thiếu Niên', // 20-40%
  Adult = 'Thanh Niên', // 40-60%
  Elder = 'Trung Niên', // 60-80%
  AncientKing = 'Cổ Vương', // 80-100%
}

export enum MutationTier {
  Common = 'Common',
  Rare = 'Rare',
  Epic = 'Epic',
  Legendary = 'Legendary',
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
