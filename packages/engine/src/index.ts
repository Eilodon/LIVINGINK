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

// DOD Module (Data-Oriented Design)
export * from './dod';

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

// Loader Module (Blueprint loading)
export * from './loader';

// Engine Class
export { Engine } from './Engine';

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
export * from './modules/cjr';

