
import { GameState, PickupKind, Food } from '../../types';
import { RING_RADII } from './cjrConstants';
import { randomRange } from '../engine/math';

export const updateDynamicBounty = (state: GameState, dt: number) => {
    // Logic: Only spawn if players in Ring 3 are few compared to total alive
    const playersAlive = state.players.filter(p => !p.isDead);
    const total = playersAlive.length;
    if (total < 2) return; // Need critical mass

    const inRing3 = playersAlive.filter(p => p.ring === 3).length;
    const ratio = inRing3 / total;

    // Trigger condition: < 30% in Ring 3, and no active vein
    if (ratio <= 0.30) {
        // Check cooldown or active vein
        const existing = state.food.find(f => f.kind === 'candy_vein');

        // Ensure we don't spam veins. Maybe use a timer in runtime?
        // For MVP, if no vein exists, spawn one with low probability per tick
        if (!existing && Math.random() < 0.005) { // ~0.3 per second at 60fps
            spawnCandyVein(state);
        }
    }
};

const spawnCandyVein = (state: GameState) => {
    const angle = Math.random() * Math.PI * 2;
    const r = randomRange(0, RING_RADII.R3 * 0.8); // Near center

    const vein: Food = {
        id: `vein_${Date.now()}`,
        position: { x: Math.cos(angle) * r, y: Math.sin(angle) * r },
        velocity: { x: 0, y: 0 },
        radius: 30, // Big
        color: '#fbbf24',
        value: 50, // Huge mass
        kind: 'candy_vein',
        pigment: { r: 1, g: 1, b: 0 }, // Yellow
        isDead: false,
        trail: []
    };

    state.food.push(vein);
    state.engine.spatialGrid.insert(vein);
    // Optional: Global Alert
    state.floatingTexts.push({
        id: `alert_${Date.now()}`,
        position: { x: vein.position.x, y: vein.position.y },
        text: "CANDY VEIN!",
        color: '#fbbf24',
        size: 24,
        life: 3.0,
        velocity: { x: 0, y: -20 }
    });
};
