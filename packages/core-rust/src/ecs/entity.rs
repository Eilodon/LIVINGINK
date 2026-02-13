use serde::{Deserialize, Serialize};

/// Maximum number of entities supported (1 million)
pub const MAX_ENTITIES: u32 = 1_000_000;

/// Entity Identifier with Generational Indexing
/// 
/// Structure (32-bit):
/// - Index: 20 bits (1,048,576 entities)
/// - Generation: 12 bits (4096 generations)
/// 
/// This allows safe reuse of IDs. If a generation mismatch occurs,
/// the entity is considered dead/invalid.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Entity {
    id: u32,
}

impl Entity {
    const INDEX_MASK: u32 = 0x000F_FFFF;
    const GEN_MASK: u32 = 0xFFF0_0000;
    const GEN_SHIFT: u32 = 20;

    pub fn new(index: u32, generation: u16) -> Self {
        assert!(index <= Self::INDEX_MASK, "Entity index out of bounds");
        let gen_part = (generation as u32) << Self::GEN_SHIFT;
        Self {
            id: (index & Self::INDEX_MASK) | gen_part,
        }
    }

    pub fn from_index(index: u32) -> Self {
        Self::new(index, 0)
    }

    pub fn index(&self) -> u32 {
        self.id & Self::INDEX_MASK
    }

    pub fn generation(&self) -> u16 {
        ((self.id & Self::GEN_MASK) >> Self::GEN_SHIFT) as u16
    }
}

/// Manages creation and destruction of entities
pub struct EntityManager {
    generations: Vec<u16>,
    free_indices: Vec<u32>,
    active_count: u32,
}

impl EntityManager {
    pub fn new(capacity: u32) -> Self {
        let cap = capacity as usize;
        let mut free_indices = Vec::with_capacity(cap);
        // Initialize free list in reverse so we pop 0 first
        for i in (0..capacity).rev() {
            free_indices.push(i);
        }

        Self {
            generations: vec![0; cap],
            free_indices,
            active_count: 0,
        }
    }

    pub fn create(&mut self) -> Option<Entity> {
        if let Some(index) = self.free_indices.pop() {
            let gen = self.generations[index as usize];
            self.active_count += 1;
            Some(Entity::new(index, gen))
        } else {
            None // Max entities reached
        }
    }

    pub fn destroy(&mut self, entity: Entity) -> bool {
        let index = entity.index() as usize;
        
        // Validation
        if index >= self.generations.len() {
            return false;
        }
        if self.generations[index] != entity.generation() {
            return false; // Already dead or reused
        }

        // Increment generation to invalidate current ID
        self.generations[index] = self.generations[index].wrapping_add(1);
        self.free_indices.push(index as u32);
        self.active_count -= 1;
        
        true
    }

    pub fn is_alive(&self, entity: Entity) -> bool {
        let index = entity.index() as usize;
        if index >= self.generations.len() {
            return false;
        }
        self.generations[index] == entity.generation()
    }

    pub fn active_count(&self) -> u32 {
        self.active_count
    }
}
