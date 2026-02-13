use crate::ecs::component::Component;
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Position {
    pub x: f32,
    pub y: f32,
}
impl Component for Position {}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Velocity {
    pub x: f32,
    pub y: f32,
}
impl Component for Velocity {}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Player {
    pub id: u32,
}
impl Component for Player {}
