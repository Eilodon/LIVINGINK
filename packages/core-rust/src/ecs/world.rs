use hecs::{World as HecsWorld, Entity, Component, Ref, RefMut};

pub struct World {
    world: HecsWorld,
}

impl World {
    pub fn new() -> Self {
        Self {
            world: HecsWorld::new(),
        }
    }

    pub fn create_entity(&mut self) -> Entity {
        self.world.spawn(())
    }

    pub fn destroy_entity(&mut self, entity: Entity) -> bool {
        self.world.despawn(entity).is_ok()
    }

    pub fn register_component<T: Component>(&mut self) {
        // hecs does not need explicit registration
    }

    pub fn add_component<T: Component>(&mut self, entity: Entity, component: T) {
        let _ = self.world.insert_one(entity, component);
    }

    pub fn get_component<T: Component>(&self, entity: Entity) -> Option<Ref<'_, T>> {
        self.world.get::<&T>(entity).ok()
    }

    pub fn get_component_mut<T: Component>(&mut self, entity: Entity) -> Option<RefMut<'_, T>> {
        self.world.get::<&mut T>(entity).ok()
    }
    
    // Expose inner world for advanced usage (iteration)
    pub fn inner(&self) -> &HecsWorld {
        &self.world
    }
    
    pub fn inner_mut(&mut self) -> &mut HecsWorld {
        &mut self.world
    }
}

