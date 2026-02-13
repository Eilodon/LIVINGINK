#[cfg(test)]
mod tests {
    use crate::ecs::world::World;
    use crate::ecs::component::Component;

    #[derive(Debug, PartialEq)]
    struct Position {
        x: f32,
        y: f32,
    }
    impl Component for Position {}

    #[derive(Debug, PartialEq)]
    struct Velocity {
        x: f32,
        y: f32,
    }
    impl Component for Velocity {}

    #[test]
    fn test_world_entity_creation() {
        let mut world = World::new();
        let entity = world.create_entity().unwrap();
        assert!(world.destroy_entity(entity));
        assert!(!world.destroy_entity(entity)); // Should return false (already destroyed)
    }

    #[test]
    fn test_component_storage() {
        let mut world = World::new();
        world.register_component::<Position>();
        world.register_component::<Velocity>();

        let entity = world.create_entity().unwrap();

        world.add_component(entity, Position { x: 10.0, y: 20.0 });
        world.add_component(entity, Velocity { x: 1.0, y: 1.0 });

        let pos = world.get_component::<Position>(entity).unwrap();
        assert_eq!(pos.x, 10.0);
        assert_eq!(pos.y, 20.0);

        let vel = world.get_component::<Velocity>(entity).unwrap();
        assert_eq!(vel.x, 1.0);
        assert_eq!(vel.y, 1.0);
    }
}
