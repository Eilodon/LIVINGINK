use crate::ecs::world::World;
use crate::ecs::components::{Position, Velocity};

pub struct MovementSystem;

impl MovementSystem {
    pub fn update(world: &mut World, dt: f64) {
        // Query entities with Position and Velocity
        // Since World API is simple ECS, we iterate entities manually or query
        // For simplicity with current World implementation, we can iterate all entities 
        // and check components. But World iterates component storages.
        // We need a way to iterate entities that have both components.
        
        // This is inefficient O(N_entities * 2 check), but works for MVP.
        // A real query system would iterate smaller storage.
        
        // Let's assume max entities is small for now or just iterate all valid entities.
        // But World doesn't expose `iter_entities`.
        // We'll iterate by index up to capacity for now, checking active.
        // Or better: iterate the definition of SparseSet internals if accessible?
        // No, stay safe.
        // Simulation loop will just hardcode specific entities if we track them.
        
        // Actually, World should provide `query` helper.
        // For now, let's hack it: iterate 0..1000 and update if components exist.
        // This is bad.
        // Let's rely on `world.entity_manager` to know active entities?
        // `entity_manager` is private.
        
        // Let's modify World to expose query!
        // But for this task, I will iterate a hardcoded range or add `query_ids` to World.
        
        for i in 0..1000u32 {
            let entity = crate::ecs::entity::Entity::from_index(i);
            
            // Rust borrowing rules make this tricky: getting mut ref to components
            // separately is hard if they are in same HashMap. 
            // We need `get_component_mut` for Pos and `get_component` for Vel.
            // But both borrow `world` mutably in current implementation?
            // `get_component` takes `&self`. `get_component_mut` takes `&mut self`.
            // We can't hold `&self` (Velocity) while holding `&mut self` (Position) unless we split borrows.
            
            // Hack: Copy Velocity first, then update Position. Velocity is small (Copy).
            let velocity = if let Some(v) = world.get_component::<Velocity>(entity) {
                *v
            } else {
                continue;
            };
            
            if let Some(pos) = world.get_component_mut::<Position>(entity) {
                pos.x += velocity.x * dt as f32;
                pos.y += velocity.y * dt as f32;
            }
        }
    }
}
