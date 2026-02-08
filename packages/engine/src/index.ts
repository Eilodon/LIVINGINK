/**
 * @eidolon/engine - Main Entry Point
 *
 * Eidolon Engine - A platform for building games.
 * The engine is game-agnostic; game logic is provided via modules (IGameModule).
 *
 * @example
 * ```typescript
 * import { Engine, eventBuffer, EngineEventType } from '@cjr/engine';
 * import { cjrModule } from '@cjr/engine/modules/cjr';
 *
 * // Load game module
 * const registry = getComponentRegistry();
 * registry.registerAll(cjrModule.getComponentSchemas());
 *
 * const engine = new Engine();
 * engine.update(dt);
 *
 * // Client: drain events for VFX
 * eventBuffer.drain((event) => {
 *   if (event.type === EngineEventType.PARTICLE_BURST) {
 *     vfxSystem.playBurst(event.x, event.y, event.data);
 *   }
 * });
 * ```
 */

// =============================================================================
// CORE (Platform-Agnostic)
// =============================================================================

// Generated Types (EIDOLON-V) - Primary source
export * from './generated';

// DOD Module (Data-Oriented Design) - Compatibility layer
// Note: EntityFlags and other types are re-exported from generated
// Import from './generated' for new code, './dod' for backward compatibility
export * from './compat';

// Core (Registry, Memory Management)
export * from './core';

// Interfaces (Contracts)
export * from './interfaces';

// Events Module
export * from './events';

// Systems Module (Core systems only: Physics, Movement)
export * from './systems';

// Math Module
export * from './math';

// Networking Module
export * from './networking';

// Config Module
export * from './config';

// Factories Module
export * from './factories';

// Utils Module (Business Logic Utilities)
export * from './utils';

// Loader Module (Blueprint loading)
export * from './loader';

// Engine Class - REMOVED (dead code)

// =============================================================================
// MODULES (Game-Specific)
// =============================================================================

// Game Modules
export * from './modules';

// =============================================================================
// BACKWARD COMPATIBILITY
// =============================================================================

// Re-export CJR module at root level for backward compatibility
// TODO: Deprecate this in favor of explicit module imports
// @deprecated Use `import { ... } from '@cjr/engine/modules/cjr'` instead


