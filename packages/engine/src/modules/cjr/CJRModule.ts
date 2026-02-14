/**
 * @eidolon/engine - CJR Game Module
 *
 * Color Jelly Rush game implementation as a pluggable module.
 * This is the reference implementation showing how to create a game module.
 */

import type {
    IGameModule,
    INetworkSchema,
    IEventDefinition,
    IInputMapping,
    IAssetEntry,
    IEntityTemplate,
    IInspectorSchema,
    IModuleConfig,
    IModuleGameState,
} from '../../interfaces/IGameModule.js';
import type { IComponentSchema } from '../../interfaces/IComponent.js';
import type { SystemFactory } from '../../interfaces/ISystem.js';
import { TattooId, MutationTier, type PigmentVec3 } from './types.js';

/**
 * CJR Module Version
 */
const CJR_VERSION = '1.0.0';

/**
 * CJR-specific component schemas
 * 
 * NOTE: These schemas should match packages/engine/scripts/schema.config.js
 * Run `npm run gen` in packages/engine to regenerate accessor code.
 * 
 * The generated code in src/generated/ is the actual runtime implementation.
 * These schemas here are for documentation and dev tools integration.
 */
const CJR_COMPONENT_SCHEMAS: IComponentSchema[] = [
    {
        id: 'Pigment',
        displayName: 'Color Pigment',
        description: 'RGB color pigment for color mixing mechanics',
        fields: [
            { name: 'r', type: 'f32', offset: 0, default: 1, min: 0, max: 1 },
            { name: 'g', type: 'f32', offset: 4, default: 1, min: 0, max: 1 },
            { name: 'b', type: 'f32', offset: 8, default: 1, min: 0, max: 1 },
            { name: 'targetR', type: 'f32', offset: 12, default: 1 },
            { name: 'targetG', type: 'f32', offset: 16, default: 1 },
            { name: 'targetB', type: 'f32', offset: 20, default: 1 },
            { name: 'matchPercent', type: 'f32', offset: 24, default: 0 },
            { name: 'colorInt', type: 'f32', offset: 28, default: 0 },
        ],
        stride: 32, // 8 fields × 4 bytes - matches schema.config.js
        tags: ['cjr', 'color'],
    },
    {
        id: 'Tattoo',
        displayName: 'Tattoo State',
        description: 'Tattoo/mutation ability timers and proc chance',
        fields: [
            { name: 'timer1', type: 'f32', offset: 0, default: 0 },
            { name: 'timer2', type: 'f32', offset: 4, default: 0 },
            { name: 'procChance', type: 'f32', offset: 8, default: 0 },
        ],
        stride: 16, // 4 fields × 4 bytes - matches schema.config.js
        tags: ['cjr', 'ability'],
    },
    {
        id: 'Skill',
        displayName: 'Skill',
        description: 'Generic skill cooldown and state',
        stride: 16, // 4 fields × 4 bytes - matches schema.config.js
        fields: [
            { name: 'cooldown', type: 'f32', offset: 0 },
            { name: 'maxCooldown', type: 'f32', offset: 4 },
            { name: 'activeTimer', type: 'f32', offset: 8 },
            { name: 'shapeId', type: 'f32', offset: 12 },
        ],
        tags: ['cjr', 'skills'],
    },
    {
        id: 'Projectile',
        displayName: 'Projectile',
        description: 'Projectile physics properties',
        stride: 16, // 4 fields × 4 bytes - matches schema.config.js
        fields: [
            { name: 'ownerId', type: 'f32', offset: 0 },
            { name: 'damage', type: 'f32', offset: 4 },
            { name: 'duration', type: 'f32', offset: 8 },
            { name: 'typeId', type: 'f32', offset: 12 },
        ],
        tags: ['cjr', 'combat'],
    },
    {
        id: 'Stats',
        displayName: 'Entity Stats',
        description: 'Health, score, and combat stats',
        stride: 32, // 8 fields × 4 bytes - matches schema.config.js
        fields: [
            { name: 'hp', type: 'f32', offset: 0, default: 100 },
            { name: 'maxHp', type: 'f32', offset: 4, default: 100 },
            { name: 'score', type: 'f32', offset: 8, default: 0 },
            { name: 'matchPercent', type: 'f32', offset: 12, default: 0 },
            { name: 'defense', type: 'f32', offset: 16, default: 1 },
            { name: 'damageMultiplier', type: 'f32', offset: 20, default: 1 },
        ],
        tags: ['cjr', 'combat'],
    },
];

/**
 * CJR Event Types
 */
const CJR_EVENT_DEFINITIONS: IEventDefinition[] = [
    { id: 1, name: 'RING_COMMIT', payload: [{ name: 'ringId', type: 'u16' }] },
    { id: 2, name: 'TATTOO_UNLOCK', payload: [{ name: 'tattooId', type: 'u16' }] },
    { id: 3, name: 'COLOR_MIX', payload: [{ name: 'resultColor', type: 'u32' }] },
    { id: 4, name: 'BOSS_SPAWN', payload: [{ name: 'bossType', type: 'u16' }] },
    { id: 5, name: 'BOSS_DEATH', payload: [] },
    { id: 6, name: 'RUSH_WINDOW_START', payload: [{ name: 'ring', type: 'u16' }] },
    { id: 7, name: 'RUSH_WINDOW_END', payload: [] },
    { id: 8, name: 'WIN_CONDITION_MET', payload: [] },
];

/**
 * CJR Network Schema
 */
const CJR_NETWORK_SCHEMA: INetworkSchema = {
    packetTypes: {
        PIGMENT_UPDATE: 10,
        RING_TRANSITION: 11,
        TATTOO_ACTIVATE: 12,
        FOOD_SPAWN: 13,
        FOOD_CONSUME: 14,
    },
    syncFields: [
        {
            componentId: 'Pigment',
            fields: ['r', 'g', 'b'],
            frequency: 'change',
        },
        {
            componentId: 'Ring',
            fields: ['currentRing', 'matchPercent'],
            frequency: 'change',
        },
        {
            componentId: 'Tattoo',
            fields: ['flags'],
            frequency: 'change',
        },
    ],
};

/**
 * CJR Input Mappings
 */
const CJR_INPUT_MAPPINGS: IInputMapping[] = [
    {
        action: 'SKILL',
        keys: ['Space'],
        touch: 'tap',
        gamepadButtons: [0], // A button
    },
    {
        action: 'EJECT',
        keys: ['KeyW', 'KeyE'],
        touch: 'hold',
        gamepadButtons: [1], // B button
    },
    {
        action: 'MOVE',
        keys: [], // Mouse-driven
        touch: 'swipe',
    },
];

/**
 * CJR Asset Manifest
 */
const CJR_ASSET_MANIFEST: IAssetEntry[] = [
    // Textures
    { key: 'jelly_base', path: 'textures/jelly_base.png', type: 'texture', priority: 100 },
    { key: 'ring_inner', path: 'textures/ring_inner.png', type: 'texture', priority: 90 },
    { key: 'ring_mid', path: 'textures/ring_mid.png', type: 'texture', priority: 90 },
    { key: 'ring_outer', path: 'textures/ring_outer.png', type: 'texture', priority: 90 },
    { key: 'food_pigment', path: 'textures/food_pigment.png', type: 'texture', priority: 80 },
    { key: 'food_neutral', path: 'textures/food_neutral.png', type: 'texture', priority: 80 },
    { key: 'food_catalyst', path: 'textures/food_catalyst.png', type: 'texture', priority: 80 },
    { key: 'boss_1', path: 'textures/boss_1.png', type: 'texture', priority: 70 },
    { key: 'boss_2', path: 'textures/boss_2.png', type: 'texture', priority: 70 },

    // Audio
    { key: 'sfx_eat', path: 'audio/eat.mp3', type: 'audio', priority: 50 },
    { key: 'sfx_ring_commit', path: 'audio/ring_commit.mp3', type: 'audio', priority: 50 },
    { key: 'sfx_skill', path: 'audio/skill.mp3', type: 'audio', priority: 50 },
    { key: 'bgm_game', path: 'audio/bgm_game.mp3', type: 'audio', priority: 60 },

    // Data
    { key: 'levels', path: 'data/levels.json', type: 'json', priority: 100 },
    { key: 'tattoos', path: 'data/tattoos.json', type: 'json', priority: 90 },
];

/**
 * CJR Entity Templates
 */
const CJR_ENTITY_TEMPLATES: IEntityTemplate[] = [
    {
        id: 'player',
        name: 'Player Jelly',
        components: {
            Transform: { x: 0, y: 0, rotation: 0, scale: 1 },
            Physics: { vx: 0, vy: 0, mass: 1, radius: 30, restitution: 0.5, friction: 0.92 },
            Stats: { currentHealth: 100, maxHealth: 100, score: 0, matchPercent: 0 },
            Pigment: { r: 0.5, g: 0.5, b: 0.5 },
            TargetPigment: { r: 1, g: 0, b: 0 },
            Ring: { currentRing: 1, matchPercent: 0 },
            Tattoo: { flags: 0, procChance: 0, timer1: 0, timer2: 0 },
        },
        flags: 0x01, // ACTIVE | PLAYER
        tags: ['player', 'controllable'],
    },
    {
        id: 'bot',
        name: 'Bot Jelly',
        components: {
            Transform: { x: 0, y: 0, rotation: 0, scale: 1 },
            Physics: { vx: 0, vy: 0, mass: 1, radius: 25, restitution: 0.5, friction: 0.92 },
            Stats: { currentHealth: 80, maxHealth: 80, score: 0, matchPercent: 0 },
            Pigment: { r: 0.5, g: 0.5, b: 0.5 },
            TargetPigment: { r: 0, g: 1, b: 0 },
            Ring: { currentRing: 1, matchPercent: 0 },
        },
        flags: 0x02, // ACTIVE | BOT
        tags: ['bot', 'ai'],
    },
    {
        id: 'food_pigment',
        name: 'Pigment Food',
        components: {
            Transform: { x: 0, y: 0, rotation: 0, scale: 1 },
            Physics: { vx: 0, vy: 0, mass: 0.1, radius: 12, restitution: 0.8, friction: 0.95 },
            Pigment: { r: 1, g: 0, b: 0 },
            FoodPickup: { kind: 0, value: 2 },
        },
        flags: 0x04, // ACTIVE | FOOD
        tags: ['food', 'pigment'],
    },
    {
        id: 'food_neutral',
        name: 'Neutral Food',
        components: {
            Transform: { x: 0, y: 0, rotation: 0, scale: 1 },
            Physics: { vx: 0, vy: 0, mass: 0.1, radius: 8, restitution: 0.8, friction: 0.95 },
            FoodPickup: { kind: 1, value: 5 },
        },
        flags: 0x04, // ACTIVE | FOOD
        tags: ['food', 'neutral'],
    },
    {
        id: 'boss',
        name: 'Boss Entity',
        components: {
            Transform: { x: 0, y: 0, rotation: 0, scale: 2 },
            Physics: { vx: 0, vy: 0, mass: 10, radius: 80, restitution: 0.3, friction: 0.85 },
            Stats: { currentHealth: 500, maxHealth: 500, score: 0, matchPercent: 0 },
        },
        flags: 0x08, // ACTIVE | BOSS
        tags: ['boss', 'enemy'],
    },
];

/**
 * CJR Inspector Schema for Dev Tools
 */
const CJR_INSPECTOR_SCHEMA: IInspectorSchema = {
    categories: [
        { id: 'players', name: 'Players', flagMask: 0x01, icon: 'user' },
        { id: 'bots', name: 'Bots', flagMask: 0x02, icon: 'robot' },
        { id: 'food', name: 'Food', flagMask: 0x04, icon: 'circle' },
        { id: 'bosses', name: 'Bosses', flagMask: 0x08, icon: 'skull' },
        { id: 'projectiles', name: 'Projectiles', flagMask: 0x10, icon: 'arrow' },
    ],
    panels: [
        { id: 'color', name: 'Color Info', componentId: 'Pigment' },
        { id: 'ring', name: 'Ring Progress', componentId: 'Ring' },
        { id: 'tattoos', name: 'Tattoos', componentId: 'Tattoo' },
    ],
};

/**
 * Color Jelly Rush Game Module
 *
 * Implements IGameModule interface for pluggable game logic.
 */
export class CJRModule implements IGameModule {
    // ==================== IDENTIFICATION ====================
    readonly id = 'cjr';
    readonly name = 'Color Jelly Rush';
    readonly version = CJR_VERSION;
    readonly description = 'A color-matching IO game where jellies compete to reach the center';

    // ==================== SCHEMA REGISTRATION ====================

    getComponentSchemas(): IComponentSchema[] {
        return CJR_COMPONENT_SCHEMAS;
    }

    getSystemFactories(): SystemFactory[] {
        // Systems are created by factories to allow deferred instantiation
        // This allows the engine to control system lifecycle
        return [
            // Note: Actual system implementations would be imported here
            // For now, returning empty array as systems are still in transition
        ];
    }

    // ==================== EVENTS & NETWORKING ====================

    getEventDefinitions(): IEventDefinition[] {
        return CJR_EVENT_DEFINITIONS;
    }

    getNetworkSchema(): INetworkSchema {
        return CJR_NETWORK_SCHEMA;
    }

    // ==================== INPUT & ASSETS ====================

    getInputMappings(): IInputMapping[] {
        return CJR_INPUT_MAPPINGS;
    }

    getAssetManifest(): IAssetEntry[] {
        return CJR_ASSET_MANIFEST;
    }

    // ==================== ENTITIES ====================

    getEntityTemplates(): IEntityTemplate[] {
        return CJR_ENTITY_TEMPLATES;
    }

    // ==================== TOOLS INTEGRATION ====================

    getInspectorSchema(): IInspectorSchema {
        return CJR_INSPECTOR_SCHEMA;
    }

    // ==================== LIFECYCLE HOOKS ====================

    onLoad(config: IModuleConfig): void {
        console.log(`[CJRModule] Loaded v${this.version}`, config);
    }

    onUnload(): void {
        console.log('[CJRModule] Unloaded');
    }

    onGameStart(state: IModuleGameState): void {
        console.log('[CJRModule] Game started', { gameTime: state.gameTime });
    }

    onGameEnd(state: IModuleGameState): void {
        console.log('[CJRModule] Game ended', { result: state.result });
    }

    onEntitySpawn(entityId: number, templateId: string): void {
        // Hook for entity spawn tracking (e.g., for analytics)
    }

    onEntityDestroy(entityId: number): void {
        // Hook for entity cleanup
    }
}

/**
 * Singleton instance for convenience
 */
export const cjrModule = new CJRModule();

/**
 * Module factory for dynamic loading
 */
export function createCJRModule(): IGameModule {
    return new CJRModule();
}
