
import { GameState, PickupKind, Food } from '../../types';
import { RING_RADII } from '../../constants';
import { randomRange } from '../math/FastMath';
import { vfxBuffer, VFX_TYPES, packHex, TEXT_IDS } from '../engine/VFXRingBuffer';

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
        color: 0xFBBF24,
        value: 50, // Huge mass
        kind: 'candy_vein',
        pigment: { r: 1, g: 1, b: 0 }, // Yellow
        isDead: false,

    };

    state.food.push(vein);
    state.engine.spatialGrid.insert(vein);
    state.food.push(vein);
    state.engine.spatialGrid.insert(vein);

    // Zero-GC VFX
    vfxBuffer.push(
        vein.position.x,
        vein.position.y,
        packHex('#fbbf24'),
        VFX_TYPES.FLOATING_TEXT,
        TEXT_IDS.CANDY_VEIN
    );
};
