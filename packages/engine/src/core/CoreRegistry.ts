/**
 * @eidolon/engine - CoreRegistry
 *
 * Registers standard engine components (Transform, Physics, Stats, Input, etc.)
 * so they exist in the ComponentRegistry before ComponentStores tries to access them.
 *
 * This is part of the Phase 3 & 4 Unification - Memory Convergence.
 */

import type { IComponentSchema } from '../interfaces/IComponent.js';
import { getComponentRegistry, type ComponentRegistry } from './ComponentRegistry.js';

// =============================================================================
// Core Component Schemas
// =============================================================================

/**
 * Transform component schema
 * [x, y, rotation, scale, prevX, prevY, prevRotation, _pad]
 */
export const TransformSchema: IComponentSchema = {
    id: 'Transform',
    displayName: 'Transform',
    description: 'Position, rotation, and scale for entities',
    stride: 32, // 8 floats × 4 bytes
    fields: [
        { name: 'x', type: 'f32', offset: 0 },
        { name: 'y', type: 'f32', offset: 4 },
        { name: 'rotation', type: 'f32', offset: 8 },
        { name: 'scale', type: 'f32', offset: 12 },
        { name: 'prevX', type: 'f32', offset: 16 },
        { name: 'prevY', type: 'f32', offset: 20 },
        { name: 'prevRotation', type: 'f32', offset: 24 },
        { name: '_pad', type: 'f32', offset: 28 },
    ],
    required: true,
    tags: ['core', 'physics', 'render'],
};

/**
 * Physics component schema
 * [vx, vy, vRotation, mass, radius, restitution, friction, _pad]
 */
export const PhysicsSchema: IComponentSchema = {
    id: 'Physics',
    displayName: 'Physics',
    description: 'Physics properties for entities',
    stride: 32, // 8 floats × 4 bytes
    fields: [
        { name: 'vx', type: 'f32', offset: 0 },
        { name: 'vy', type: 'f32', offset: 4 },
        { name: 'vRotation', type: 'f32', offset: 8 },
        { name: 'mass', type: 'f32', offset: 12 },
        { name: 'radius', type: 'f32', offset: 16 },
        { name: 'restitution', type: 'f32', offset: 20 },
        { name: 'friction', type: 'f32', offset: 24 },
        { name: '_pad', type: 'f32', offset: 28 },
    ],
    required: true,
    tags: ['core', 'physics'],
};

/**
 * Stats component schema
 * [currentHealth, maxHealth, score, matchPercent, defense, damageMultiplier, _pad, _pad]
 */
export const StatsSchema: IComponentSchema = {
    id: 'Stats',
    displayName: 'Stats',
    description: 'Entity statistics (health, score, etc.)',
    stride: 32, // 8 floats × 4 bytes
    fields: [
        { name: 'currentHealth', type: 'f32', offset: 0 },
        { name: 'maxHealth', type: 'f32', offset: 4 },
        { name: 'score', type: 'f32', offset: 8 },
        { name: 'matchPercent', type: 'f32', offset: 12 },
        { name: 'defense', type: 'f32', offset: 16 },
        { name: 'damageMultiplier', type: 'f32', offset: 20 },
        { name: '_pad1', type: 'f32', offset: 24 },
        { name: '_pad2', type: 'f32', offset: 28 },
    ],
    required: false,
    tags: ['core', 'gameplay'],
};

/**
 * State component schema (flags)
 * Uses Uint16Array - defined as u16 fields but stored as single array
 */
export const StateSchema: IComponentSchema = {
    id: 'State',
    displayName: 'State',
    description: 'Entity state flags (active, dead, etc.)',
    stride: 2, // 1 uint16 × 2 bytes
    fields: [
        { name: 'flags', type: 'u16', offset: 0 },
    ],
    required: true,
    tags: ['core', 'lifecycle'],
};

/**
 * Input component schema (GENERIC)
 * [targetX, targetY, actions (bitmask), _pad]
 * 
 * actions bitmask (uint32):
 *   Bit 0-7:   Digital actions (jump, shoot, eject, etc.)
 *   Bit 8-15:  Skill slots
 *   Bit 16-23: Modifier keys
 *   Bit 24-31: Reserved
 * 
 * CJR Mapping (defined in CJRModule):
 *   Bit 1 = Eject
 *   Bit 2 = Skill
 */
export const InputSchema: IComponentSchema = {
    id: 'Input',
    displayName: 'Input',
    description: 'Generic input state with action bitmask',
    stride: 16, // 4 floats × 4 bytes
    fields: [
        { name: 'targetX', type: 'f32', offset: 0 },
        { name: 'targetY', type: 'f32', offset: 4 },
        { name: 'actions', type: 'f32', offset: 8 },  // u32 stored as f32 for TypedArray compatibility
        { name: '_pad', type: 'f32', offset: 12 },
    ],
    required: false,
    tags: ['core', 'input'],
};

/**
 * Config component schema
 * [maxSpeed, speedMultiplier, magnetRadius, _pad]
 */
export const ConfigSchema: IComponentSchema = {
    id: 'Config',
    displayName: 'Config',
    description: 'Entity configuration (speed, magnet, etc.)',
    stride: 16, // 4 floats × 4 bytes
    fields: [
        { name: 'maxSpeed', type: 'f32', offset: 0 },
        { name: 'speedMultiplier', type: 'f32', offset: 4 },
        { name: 'magnetRadius', type: 'f32', offset: 8 },
        { name: '_pad', type: 'f32', offset: 12 },
    ],
    required: false,
    tags: ['core', 'config'],
};



// =============================================================================
// Core Registry Helper
// =============================================================================

/**
 * Array of all core component schemas.
 * These are registered at engine initialization.
 * 
 * NOTE: TattooSchema removed - it's CJR-specific.
 * Tattoo is now registered by CJRModule.
 */
export const CORE_COMPONENT_SCHEMAS: IComponentSchema[] = [
    TransformSchema,
    PhysicsSchema,
    StatsSchema,
    StateSchema,
    InputSchema,
    ConfigSchema,
    // TattooSchema removed - CJR-specific, moved to CJRModule
    // SkillSchema removed - CJR-specific, moved to CJRModule
    // ProjectileSchema removed - CJR-specific, moved to CJRModule
];

/**
 * Register all core components with the provided registry.
 * Should be called once at engine initialization before any ComponentStore access.
 *
 * @param registry - ComponentRegistry instance (defaults to global)
 */
export function registerCoreComponents(registry: ComponentRegistry = getComponentRegistry()): void {
    console.info('[CoreRegistry] Registering core components...');

    for (const schema of CORE_COMPONENT_SCHEMAS) {
        // Skip if already registered (idempotent)
        if (registry.has(schema.id)) {
            console.info(`[CoreRegistry] ${schema.id} already registered, skipping`);
            continue;
        }
        registry.register(schema);
    }

    console.info(`[CoreRegistry] Registered ${CORE_COMPONENT_SCHEMAS.length} core components`);
}

/**
 * Initialize the core registry and freeze it.
 * Call this after all modules are loaded and before the game starts.
 *
 * @param registry - ComponentRegistry instance (defaults to global)
 */
export function initializeAndFreezeCoreRegistry(registry: ComponentRegistry = getComponentRegistry()): void {
    registerCoreComponents(registry);
    registry.freeze();
    console.info('[CoreRegistry] Core registry initialized and frozen');
}
