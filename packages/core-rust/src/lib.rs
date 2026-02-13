mod ecs;
mod sim;

use wasm_bindgen::prelude::*;
use sim::grid::GridState; // Import GridState
pub use sim::simulation::Simulation;
pub use ecs::component::Component;

mod tests;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Helper để panic hook hoạt động tốt trên browser console
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

// Factory function để tạo GridState từ JS
#[wasm_bindgen]
pub fn create_grid(width: usize, height: usize, seed: u64) -> GridState {
    GridState::new(width, height, seed)
}
