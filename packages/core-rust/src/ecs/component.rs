use super::entity::Entity;
use std::any::Any;

pub trait Component: Any + Sized {}

/// Storage interface for components
pub trait Storage {
    fn as_any(&self) -> &dyn Any;
    fn as_any_mut(&mut self) -> &mut dyn Any;
}

/// Sparse Set Storage
/// 
/// High performance storage:
/// - O(1) insertion
/// - O(1) removal
/// - O(1) lookup
/// - O(N) iteration (cache friendly packed data)
pub struct SparseSet<T> {
    pub dense: Vec<T>,           // Packed components
    pub entities: Vec<Entity>,   // Entity ID for each component
    pub sparse: Vec<usize>,      // Entity ID -> Dense Index
    pub capacity: usize,
}

impl<T: Component> SparseSet<T> {
    pub fn new(capacity: usize) -> Self {
        Self {
            dense: Vec::with_capacity(capacity),
            entities: Vec::with_capacity(capacity),
            sparse: vec![usize::MAX; capacity], // MAX = empty
            capacity,
        }
    }

    pub fn insert(&mut self, entity: Entity, component: T) {
        let id = entity.index() as usize;
        if id >= self.sparse.len() {
            // Resize sparse array if needed (though capacity should be fixed)
            self.sparse.resize(id + 1, usize::MAX);
        }

        let dense_index = self.dense.len();
        self.dense.push(component);
        self.entities.push(entity);
        self.sparse[id] = dense_index;
    }

    pub fn remove(&mut self, entity: Entity) -> Option<T> {
        let id = entity.index() as usize;
        if id >= self.sparse.len() {
            return None;
        }

        let dense_index = self.sparse[id];
        if dense_index == usize::MAX {
            return None;
        }

        // Swap Remove O(1)
        let last_index = self.dense.len() - 1;
        let last_entity = self.entities[last_index];

        // 1. Swap with last element
        self.dense.swap(dense_index, last_index);
        self.entities.swap(dense_index, last_index);

        // 2. Update sparse map for the swapped element
        self.sparse[last_entity.index() as usize] = dense_index;
        self.sparse[id] = usize::MAX;

        // 3. Remove last
        self.entities.pop();
        Some(self.dense.pop().unwrap())
    }

    pub fn get(&self, entity: Entity) -> Option<&T> {
        let id = entity.index() as usize;
        if id >= self.sparse.len() {
            return None;
        }
        let dense_index = self.sparse[id];
        if dense_index == usize::MAX {
            return None;
        }
        Some(&self.dense[dense_index])
    }
    
    pub fn get_mut(&mut self, entity: Entity) -> Option<&mut T> {
        let id = entity.index() as usize;
        if id >= self.sparse.len() {
            return None;
        }
        let dense_index = self.sparse[id];
        if dense_index == usize::MAX {
            return None;
        }
        Some(&mut self.dense[dense_index])
    }
}

impl<T: Component + 'static> Storage for SparseSet<T> {
    fn as_any(&self) -> &dyn Any {
        self
    }
    fn as_any_mut(&mut self) -> &mut dyn Any {
        self
    }
}
