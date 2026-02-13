use super::entity::{Entity, EntityManager, MAX_ENTITIES};
use super::component::{Component, SparseSet}; // Removed Storage import as it's not used directly
use std::any::{Any, TypeId};
use std::collections::HashMap;

// Note: We don't stick #[wasm_bindgen] here yet because HashMap/Box<dyn Any> 
// is not easily exportable. We keep World internal to Rust for now.
pub struct World {
    entity_manager: EntityManager,
    // Map TypeId -> Storage (SparseSet<T>)
    components: HashMap<TypeId, Box<dyn Any>>, 
}

impl World {
    pub fn new() -> Self {
        Self {
            entity_manager: EntityManager::new(MAX_ENTITIES),
            components: HashMap::new(),
        }
    }

    pub fn create_entity(&mut self) -> Option<Entity> {
        self.entity_manager.create()
    }

    pub fn destroy_entity(&mut self, entity: Entity) -> bool {
        self.entity_manager.destroy(entity)
        // TODO: Remove components for this entity?
        // In a real ECS we would iterate all storages and remove. 
        // For now, let's keep it simple.
    }

    pub fn register_component<T: Component + 'static>(&mut self) {
        let type_id = TypeId::of::<T>();
        self.components.insert(
            type_id, 
            Box::new(SparseSet::<T>::new(MAX_ENTITIES as usize))
        );
    }

    pub fn add_component<T: Component + 'static>(&mut self, entity: Entity, component: T) {
        let type_id = TypeId::of::<T>();
        if let Some(storage_any) = self.components.get_mut(&type_id) {
            if let Some(storage) = storage_any.downcast_mut::<SparseSet<T>>() {
                storage.insert(entity, component);
            }
        }
    }

    pub fn get_component<T: Component + 'static>(&self, entity: Entity) -> Option<&T> {
        let type_id = TypeId::of::<T>();
        if let Some(storage_any) = self.components.get(&type_id) {
            if let Some(storage) = storage_any.downcast_ref::<SparseSet<T>>() {
                return storage.get(entity);
            }
        }
        None
    }

    pub fn get_component_mut<T: Component + 'static>(&mut self, entity: Entity) -> Option<&mut T> {
        let type_id = TypeId::of::<T>();
        if let Some(storage_any) = self.components.get_mut(&type_id) {
            if let Some(storage) = storage_any.downcast_mut::<SparseSet<T>>() {
                return storage.get_mut(entity);
            }
        }
        None
    }
}
