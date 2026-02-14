use crate::ecs::world::World;
use crate::ecs::components::{Position, Velocity, Player};
use crate::sim::systems::MovementSystem;
use crate::sim::grid::GridState;
use wasm_bindgen::prelude::*;
use serde::Serialize;

#[derive(Serialize)]
struct EntityState {
    id: u64,
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

    // Zero-Copy Buffers
    entity_ids: Vec<u64>,
    positions: Vec<Position>,
    velocities: Vec<Velocity>,
}

#[wasm_bindgen]
impl Simulation {
    #[wasm_bindgen(constructor)]
    pub fn new(width: usize, height: usize, seed: u64) -> Self {
        console_error_panic_hook::set_once();
        
        // Init Physics World
        let mut world = World::new();
        
        // Registered Components (noop in hecs wrapper)
        world.register_component::<Position>();
        world.register_component::<Velocity>();
        world.register_component::<Player>();
        
        // Init Test State directly here for now
        let e = world.create_entity();
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
            entity_ids: Vec::with_capacity(1024),
            positions: Vec::with_capacity(1024),
            velocities: Vec::with_capacity(1024),
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

    /// Synchronize ECS state to continuous buffers for Zero-Copy access
    pub fn sync_buffers(&mut self) {
        self.entity_ids.clear();
        self.positions.clear();
        self.velocities.clear();

        for (e, (pos, vel)) in self.world.inner().query::<(&Position, Option<&Velocity>)>().iter() {
            self.entity_ids.push(e.to_bits().get());
            self.positions.push(*pos);
            self.velocities.push(vel.copied().unwrap_or(Velocity { x: 0.0, y: 0.0 }));
        }
    }

    pub fn get_entity_ids_ptr(&self) -> *const u64 { self.entity_ids.as_ptr() }
    pub fn get_positions_ptr(&self) -> *const Position { self.positions.as_ptr() }
    pub fn get_velocities_ptr(&self) -> *const Velocity { self.velocities.as_ptr() }
    pub fn get_entities_count(&self) -> usize { self.entity_ids.len() }
    
    // Helper to get raw pointer to world for other WASM modules (if needed)
    pub fn world_ptr(&self) -> *const World {
        &self.world
    }
    
    pub fn get_state(&self) -> Result<JsValue, JsValue> {
        // Optimized legacy bridge: uses synced buffers if they match current state, 
        // or just re-runs query. For SOTA we avoid this, but keeping for compatibility.
        let mut entities = Vec::new();
        for i in 0..self.entity_ids.len() {
            entities.push(EntityState {
                id: self.entity_ids[i],
                pos: Some(self.positions[i]),
                vel: Some(self.velocities[i]),
            });
        }
        
        let state = GameState {
            entities,
            time: self.game_time,
        };
        
        serde_wasm_bindgen::to_value(&state).map_err(|e| e.into())
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
    // Type: 1 = Destruction (Red), 2 = Generation (Blue)
    pub fn preview_swap(&mut self, x1: usize, y1: usize, x2: usize, y2: usize) -> Vec<u32> {
         let w = self.grid.get_width();
         let idx1 = y1 * w + x1;
         let idx2 = y2 * w + x2;
         self.grid.preview_swap(idx1, idx2)
    }

    pub fn preview_neighbors(&mut self, x: usize, y: usize) -> Vec<u32> {
        self.grid.preview_neighbors(x, y)
    }

    pub fn get_fluid_events(&self) -> JsValue {
        JsValue::UNDEFINED
    }
    
    pub fn clear_fluid_events(&mut self) {
        self.grid.clear_events();
    }
    
    // FLUID BRIDGE
    pub fn apply_fluid_density(&mut self, density: &[u8], fluid_w: usize, fluid_h: usize) {
        self.grid.apply_fluid_density(density, fluid_w, fluid_h);
    }
    
    // CYCLE BRIDGE
    pub fn is_avatar_state(&self) -> bool {
        self.grid.is_avatar_state()
    }
    
    // Setters
    pub fn set_cell_element(&mut self, idx: usize, element: u8) {
        self.grid.set_cell_element(idx, element);
    }

    pub fn set_cell_flag(&mut self, idx: usize, flag: u8) {
        self.grid.set_cell_flag(idx, flag);
    }
    
    pub fn unset_cell_flag(&mut self, idx: usize, flag: u8) {
        self.grid.unset_cell_flag(idx, flag);
    }

    pub fn spawn_special(&mut self, count: usize, element: u8, flags: u8, exclude_element: u8) -> Vec<usize> {
        self.grid.spawn_special(count, element, flags, exclude_element)
    }

    pub fn get_checksum(&self) -> u32 {
        self.grid.get_checksum()
    }
}
