import { MAX_ENTITIES, EntityFlags } from '../EntityFlags';
import { TransformStore, PhysicsStore, StateStore } from '../ComponentStores';
import { Player } from '../../../../types';

export class MovementSystem {
    // Logic to apply input forces would go here.
    // Currently, inputs are handled by `GameStateManager` modifying `Player` object.
    // We need to sync `Player` -> `PhysicsStore` (Push) if we keep Hybrid input logic.
    // OR move input logic here.

    // For Phase 2, we support syncing "Player Object Logic" pushing velocity to DOD.

    static syncPlayerToDOD(player: Player, id: number) {
        if ((StateStore.flags[id] & EntityFlags.ACTIVE) === 0) return;

        // We assume Player update logic (Input -> Velocity) ran in OptimizedEngine.
        // Now we push that velocity to DOD.
        PhysicsStore.set(id, player.velocity.x, player.velocity.y, 10, player.radius); // Mass?
        TransformStore.set(id, player.position.x, player.position.y, 0, 1);
    }

    static syncDODToPlayer(player: Player, id: number) {
        if ((StateStore.flags[id] & EntityFlags.ACTIVE) === 0) return;

        const tIdx = id * TransformStore.STRIDE;
        const pIdx = id * PhysicsStore.STRIDE;

        player.position.x = TransformStore.data[tIdx];
        player.position.y = TransformStore.data[tIdx + 1];
        player.velocity.x = PhysicsStore.data[pIdx];
        player.velocity.y = PhysicsStore.data[pIdx + 1];
    }
    static applyInput(
        position: { x: number, y: number },
        velocity: { x: number, y: number },
        target: { x: number, y: number },
        stats: { maxSpeed: number, speedMultiplier: number },
        dt: number
    ) {
        const dx = target.x - position.x;
        const dy = target.y - position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > 25) { // 5px deadzone squared
            const speed = stats.maxSpeed * stats.speedMultiplier;
            const dist = Math.sqrt(distSq);

            // Normalize and apply velocity
            velocity.x = (dx / dist) * speed;
            velocity.y = (dy / dist) * speed;
        } else {
            // Apply friction when close to target
            velocity.x *= 0.9;
            velocity.y *= 0.9;
        }
    }
}
