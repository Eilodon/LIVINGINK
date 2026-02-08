/**
 * @cjr/client - EntityManager Singleton Wrapper
 *
 * EIDOLON-V CONSOLIDATION: This module re-exports the engine's EntityManager
 * with a client-specific singleton pattern for backward compatibility.
 *
 * Engine's EntityManager is non-singleton by design (for server multi-room).
 * Client wraps it as singleton since we only have one game instance at a time.
 */

// Re-export types from engine
export { EntityManager } from '@cjr/engine';
export type { EntityHandle } from '@cjr/engine';

import { EntityManager } from '@cjr/engine';

// Client singleton instance
let _instance: EntityManager | null = null;

/**
 * Get the singleton EntityManager instance for the client.
 * Creates the instance on first call (lazy initialization).
 */
export function getEntityManager(): EntityManager {
  if (!_instance) {
    _instance = new EntityManager();
  }
  return _instance;
}

/**
 * Reset the singleton (for testing or game restart).
 * After calling this, getEntityManager() will create a new instance.
 */
export function resetEntityManager(): void {
  if (_instance) {
    _instance.reset();
  }
  _instance = null;
}

/**
 * @deprecated Use getEntityManager() for explicit dependency.
 * This export is for backward compatibility with existing code.
 */
export const entityManager = getEntityManager();
