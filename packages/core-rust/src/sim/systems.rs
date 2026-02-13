use crate::ecs::world::World;
use crate::ecs::components::{Position, Velocity};

pub struct MovementSystem;

impl MovementSystem {
    pub fn update(world: &mut World, dt: f64) {
        // Use hecs query for efficient iteration
        for (_, (pos, vel)) in world.inner_mut().query::<(&mut Position, &Velocity)>().iter() {
            pos.x += vel.x * dt as f32;
            pos.y += vel.y * dt as f32;
        }
    }
}
