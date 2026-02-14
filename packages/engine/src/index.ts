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
export * from './generated/index.js';

// Core (Registry, Memory Management)
export * from './core/index.js';

// Interfaces (Contracts)
export * from './interfaces/index.js';

// Events Module
export * from './events/index.js';

// Systems Module (Core systems only: Physics, Movement)
export * from './systems/index.js';
export * from './systems/PerformanceManager.js';

// Math Module
export * from './math/index.js';

// Networking Module
export * from './networking/index.js';

// Config Module
export * from './config/index.js';

// Client Module (Fluid, Rendering)
export * from './client/index.js';
export * from './renderer/FluidRenderer.js';

// Factories Module
export * from './factories/index.js';

// Utils Module (Business Logic Utilities)
export * from './utils/index.js';

// Loader Module (Blueprint loading)
export * from './loader/index.js';

// Engine Class - REMOVED (dead code)

// =============================================================================
// MODULES (Game-Specific)
// =============================================================================

// Game Modules
export * from './modules/index.js';

// =============================================================================
// BACKWARD COMPATIBILITY
// =============================================================================

// Re-export CJR module at root level for backward compatibility
// TODO: Deprecate this in favor of explicit module imports
// @deprecated Use `import { ... } from '@cjr/engine/modules/cjr'` instead


