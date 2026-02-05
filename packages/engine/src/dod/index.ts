/**
 * @cjr/engine - DOD Module
 * Data-Oriented Design stores and flags
 * 
 * EIDOLON-V UNIFICATION: This is the SINGLE SOURCE OF TRUTH for all DOD stores.
 * Client app should import from here, NOT maintain local copies.
 */

export { EntityFlags, MAX_ENTITIES } from './EntityFlags';
export {
    TransformStore,
    PhysicsStore,
    StateStore,
    StatsStore,
    SkillStore,
    TattooStore,
    ProjectileStore,
    ConfigStore,
    InputStore,
    PigmentStore,
    EntityLookup,
    resetAllStores,
} from './ComponentStores';
export {
    type IEntityLookup,
    type IEngineEntity,
    createArrayLookup,
    createMapLookup,
} from './IEntityLookup';
