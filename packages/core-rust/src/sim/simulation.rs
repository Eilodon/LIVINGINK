use crate::ecs::world::World;
use crate::ecs::components::{Position, Velocity, Player};
use crate::sim::systems::MovementSystem;
use wasm_bindgen::prelude::*;
use serde::Serialize;

#[derive(Serialize)]
struct EntityState {
    id: u32,
    pos: Option<Position>,
    vel: Option<Velocity>,
}

#[derive(Serialize)]
struct GameState {
    entities: Vec<EntityState>,
    time: f64,
}

#[wasm_bindgen]
pub struct Simulation {
    world: World,
    accumulator: f64,
    game_time: f64,
    frame_count: u64,
}

#[wasm_bindgen]
impl Simulation {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_error_panic_hook::set_once();
        
        let mut world = World::new();
        
        // Register Components
        world.register_component::<Position>();
        world.register_component::<Velocity>();
        world.register_component::<Player>();
        
        // Init Test State directly here for now
        let e = world.create_entity().unwrap();
        world.add_component(e, Position { x: 100.0, y: 100.0 });
        world.add_component(e, Velocity { x: 10.0, y: 5.0 });
        world.add_component(e, Player { id: 1 });
        
        Self {
            world,
            accumulator: 0.0,
            game_time: 0.0,
            frame_count: 0,
        }
    }

    /// Fixed Timestep Loop
    pub fn update(&mut self, dt_ms: f64) -> f64 {
        const FIXED_DT: f64 = 1.0 / 60.0;
        const MAX_FRAME_TIME: f64 = 0.25;

        // Convert ms to seconds
        let dt_sec = dt_ms / 1000.0;
        
        // Clamp frame time to avoid spiral of death
        let dt_clamped = if dt_sec > MAX_FRAME_TIME { MAX_FRAME_TIME } else { dt_sec };

        self.accumulator += dt_clamped;

        while self.accumulator >= FIXED_DT {
            self.tick(FIXED_DT);
            self.accumulator -= FIXED_DT;
            self.game_time += FIXED_DT;
            self.frame_count += 1;
        }

        // Return alpha for interpolation
        self.accumulator / FIXED_DT
    }

    fn tick(&mut self, dt: f64) {
        MovementSystem::update(&mut self.world, dt);
    }
    
    // Helper to get raw pointer to world for other WASM modules (if needed)
    pub fn world_ptr(&self) -> *const World {
        &self.world
    }
    
    pub fn get_state(&self) -> JsValue {
        let mut entities = Vec::new();
        
        // Naive iteration for state sync
        // In real ECS we would query "Changed" or "All"
        for i in 0..100u32 {
            let e = crate::ecs::entity::Entity::from_index(i);
            
            // Check if active (hack: check if has Position)
            if let Some(pos) = self.world.get_component::<Position>(e) {
                let vel = self.world.get_component::<Velocity>(e).copied();
                entities.push(EntityState {
                    id: e.index(),
                    pos: Some(*pos),
                    vel,
                });
            }
        }
        
        let state = GameState {
            entities,
            time: self.game_time,
        };
        
        serde_wasm_bindgen::to_value(&state).unwrap()
    }
}
