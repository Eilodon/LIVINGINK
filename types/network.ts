/**
 * EIDOLON-V P3: Network State Types
 * Proper types for server state sync to replace `any` in NetworkClient
 */

import { Vector2 } from './entity';

// ============================================
// Server Player State (from Colyseus schema)
// ============================================

export interface ServerPlayerState {
    id: string;
    sessionId: string;
    name: string;
    shape: string;

    // Position & Physics
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    radius: number;

    // Stats
    score: number;
    kills: number;
    maxHealth: number;
    currentHealth: number;
    matchPercent: number;

    // Game State
    ring: number;
    emotion: string;
    isDead: boolean;
    skillCooldown: number;
    lastProcessedInput: number;

    // Pigment
    pigment: { r: number; g: number; b: number };
    targetPigment: { r: number; g: number; b: number };

    // Optional
    tattoos?: number[];
    statusFlags?: number;
}

// ============================================
// Server Bot State
// ============================================

export interface ServerBotState extends ServerPlayerState {
    aiState?: string;
    personality?: string;
    isBoss?: boolean;
    isElite?: boolean;
    isCreep?: boolean;
}

// ============================================
// Server Food State
// ============================================

export interface ServerFoodState {
    id: string;
    x: number;
    y: number;
    radius: number;
    isDead?: boolean;
    value?: number;
    kind: number;
    pigment: { r: number; g: number; b: number };
}

// ============================================
// Server Projectile State
// ============================================

export interface ServerProjectileState {
    id: string;
    ownerId: string;
    type: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
}

// ============================================
// Server VFX Event
// ============================================

export interface ServerVFXEvent {
    type: number;
    x: number;
    y: number;
    data: number;
    id: string;
    seq: number;
    color: number;
}

// ============================================
// Server Game State (Full Room State)
// ============================================

export interface ServerGameState {
    players: Map<string, ServerPlayerState>;
    bots: Map<string, ServerBotState>;
    food: Map<string, ServerFoodState>;
    projectiles: Map<string, ServerProjectileState>;
    vfxEvents: ServerVFXEvent[];

    worldWidth: number;
    worldHeight: number;
    gameTime: number;

    // VFX Ring Buffer
    vfxHead: number;
    vfxTail: number;
}

// ============================================
// Network Input Types
// ============================================

export interface NetworkInput {
    seq: number;
    targetX: number;
    targetY: number;
    space: boolean;
    w: boolean;
}

export interface NetworkInputEvent {
    type: 'skill' | 'eject' | 'boost';
    timestamp: number;
}

// ============================================
// Binary Transform Update
// ============================================

export interface TransformUpdate {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

// ============================================
// Network Snapshot (for interpolation)
// ============================================

export interface NetworkSnapshot {
    serverTime: number;
    players: Map<string, { x: number; y: number; vx: number; vy: number }>;
    bots: Map<string, { x: number; y: number; vx: number; vy: number }>;
    food: Map<string, { x: number; y: number }>;
}
