use crate::ecs::world::World;
use crate::ecs::components::{Position, Velocity, Player};
use crate::sim::systems::MovementSystem;
use crate::sim::grid::GridState;
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
    grid: GridState,
    accumulator: f64,
    game_time: f64,
    frame_count: u64,
}

#[wasm_bindgen]
impl Simulation {
    #[wasm_bindgen(constructor)]
    pub fn new(width: usize, height: usize, seed: u64) -> Self {
        console_error_panic_hook::set_once();
        
        // Init Physics World
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
        
        // Init Grid
        let grid = GridState::new(width, height, seed);

        Self {
            world,
            grid,
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
        // Step grid logic
        self.grid.tick();
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
    pub fn get_grid(&mut self) -> *mut GridState {
        &mut self.grid
    }
    
    // Delegate to GridState
    pub fn get_cells_ptr(&self) -> *const crate::sim::grid::Cell {
        self.grid.get_cells_ptr()
    }
    
    pub fn get_cells_len(&self) -> usize {
        self.grid.get_cells_len()
    }

    pub fn check_matches(&mut self) -> Vec<usize> {
        // Not exposed in new GridState
        Vec::new()
    }

    pub fn swap(&mut self, x1: usize, y1: usize, x2: usize, y2: usize) -> bool {
         let w = self.grid.get_width();
         let idx1 = y1 * w + x1;
         let idx2 = y2 * w + x2;
         self.grid.try_swap(idx1, idx2)
    }

    pub fn tick_grid(&mut self) {
        self.grid.tick();
    }
    
    // Updated Event API
    pub fn get_events_ptr(&self) -> *const u32 {
        self.grid.get_events_ptr()
    }

    pub fn get_events_len(&self) -> usize {
        self.grid.get_events_len()
    }

    pub fn clear_events(&mut self) {
        self.grid.clear_events();
    }

    pub fn get_score(&self) -> u32 {
        self.grid.get_score()
    }

    pub fn get_cycle_target(&self) -> u8 {
        self.grid.get_cycle_target()
    }

    pub fn get_cycle_chain(&self) -> u32 {
        self.grid.get_cycle_chain()
    }

    pub fn get_cycle_multiplier(&self) -> u32 {
        self.grid.get_cycle_multiplier()
    }

    pub fn get_match_queue_ptr(&self) -> *const u8 {
        self.grid.get_match_queue_ptr()
    }

    pub fn get_match_queue_len(&self) -> usize {
        self.grid.get_match_queue_len()
    }

    pub fn clear_match_queue(&mut self) {
        self.grid.clear_match_queue();
    }
    
    // PREVIEW API
    // Returns flat array: [index, type, index, type...]
    pub fn get_swap_preview(&mut self, x1: usize, y1: usize, x2: usize, y2: usize) -> Vec<u32> {
         let w = self.grid.get_width();
         let idx1 = y1 * w + x1;
         let idx2 = y2 * w + x2;
         self.grid.preview_swap(idx1, idx2)
    }

    // Deprecated methods from old GridState
    pub fn get_fluid_events(&self) -> JsValue {
        JsValue::UNDEFINED
    }
    
    pub fn clear_fluid_events(&mut self) {
        self.grid.clear_events();
    }
    
    // Setters - removed as they are not in new GridState public API
    pub fn set_cell(&mut self, _x: usize, _y: usize, _val: u8) {}
    pub fn set_cell_flags(&mut self, _x: usize, _y: usize, _val: u8, _flags: u8) {}
}
