import { WorldState } from '../../engine/src/generated/WorldState';
import { IGameModule, IGameContext } from '../../engine/src/core/IGameModule';
import { TransformAccess, PhysicsAccess, StateAccess, EntityFlags } from '../../engine/src/generated/ComponentAccessors';

export class JellySumoModule implements IGameModule {
    readonly id = 'jelly-sumo';
    readonly name = 'Jelly Sumo';

    private ringEntityId = -1;
    private gameTime = 0;
    private static readonly SHRINK_START = 5; // Seconds before shrink starts
    private static readonly SHRINK_SPEED = 10; // Pixels per second
    private ringRadius = 1600; // EIDOLON-V FIX: Must match MAP_RADIUS, entities spawn at 1000-1600

    async onMount(world: WorldState, context: IGameContext): Promise<void> {
        console.log(`[JellySumo] Module Mounted (Radius=${this.ringRadius})`);

        // Spawn Ring Entity
        this.ringEntityId = context.entityManager.createEntity();
        if (this.ringEntityId !== -1) {
            StateAccess.activate(world, this.ringEntityId);
            StateAccess.setFlag(world, this.ringEntityId, EntityFlags.STRUCTURE);
            // Flag as Structure so it doesn't get moved by physics integration directly?
            // Actually, we want it static. Mass = Infinity.
            // But we update its radius manually.

            TransformAccess.set(world, this.ringEntityId, 0, 0, 0, 1, 0, 0, 0);

            // Radius=300, Mass=100000 (Staticish), Restitution=1
            PhysicsAccess.set(world, this.ringEntityId, 0, 0, 0, 100000, this.ringRadius, 1, 0.5);

            // Visual: Color=Red (0xFF0000), Shape=RING (4)
            context.spawnVisual(this.ringEntityId, 0xFF4444, 4);
        }

        this.gameTime = 0;
    }

    onUnmount(world: WorldState): void {
        console.log('[JellySumo] Module Unmounted');
    }

    onUpdate(world: WorldState, dt: number): void {
        this.gameTime += dt;

        // 1. Shrink Logic
        if (this.gameTime > JellySumoModule.SHRINK_START) {
            this.ringRadius -= JellySumoModule.SHRINK_SPEED * dt;
            if (this.ringRadius < 50) this.ringRadius = 50; // Minimum size

            // Update Ring Entity Physics
            if (this.ringEntityId !== -1) {
                PhysicsAccess.setRadius(world, this.ringEntityId, this.ringRadius);
            }
        }

        // 2. Ring Out Logic
        const count = world.activeCount;
        const activeEntities = world.activeEntities;
        const ringRadSq = this.ringRadius * this.ringRadius;

        // DEBUG: Trace ring status occasionally
        if (Math.random() < 0.01) {
            console.log(`[JellySumo] Update: time=${this.gameTime.toFixed(1)}, radius=${this.ringRadius.toFixed(1)}, radSq=${ringRadSq}`);
        }


        for (let i = 0; i < count; i++) {
            const id = activeEntities[i];
            if (id === this.ringEntityId) continue;
            if (StateAccess.isDead(world, id)) continue;

            // Simple Ring constraint
            const x = TransformAccess.getX(world, id);
            const y = TransformAccess.getY(world, id);
            const distSq = x * x + y * y;

            if (distSq > ringRadSq) {
                // RING OUT!
                // Mark as dead immediately. 
                // In future: Add "Falling" animation state?
                StateAccess.markDead(world, id);
                console.log(`[JellySumo] Entity ${id} Ring Out! pos=(${x.toFixed(1)},${y.toFixed(1)}) distSq=${distSq} > ${ringRadSq}`);
            }
        }
    }

    onPlayerInput(world: WorldState, input: any): void {
        // Handled by generic MovementSystem for now
    }
}
