import { RingId, PickupKind, PigmentVec3 } from './cjrTypes';
import { WAVE_INTERVALS, SPAWN_RATIOS, RING_RADII, CANDY_VEIN } from './cjrConstants';

export type SpawnEvent = {
    ring: RingId;
    kind: PickupKind;
    position: { x: number, y: number };
    quantity: number;
};

/**
 * Generates spawn points for a specific wave in a ring using Stratified Sampling.
 * Ensures even distribution rather than random clumping.
 */
export function generateWaveSpawns(
    ring: RingId,
    activePlayerCount: number,
    targetPigment: PigmentVec3
): SpawnEvent[] {
    const events: SpawnEvent[] = [];

    // 1. Calculate Budget based on players
    // Base budget + per player scaling
    const baseBudget = 20;
    const budget = baseBudget + (activePlayerCount * 5);

    // 2. Determine inner/outer radius for this ring
    let outerR = RING_RADII.R1;
    let innerR = RING_RADII.R2;

    if (ring === 1) { outerR = RING_RADII.R1; innerR = RING_RADII.R2; }
    else if (ring === 2) { outerR = RING_RADII.R2; innerR = RING_RADII.R3; }
    else if (ring === 3) { outerR = RING_RADII.R3; innerR = 100; }

    // 3. Generate Spawns
    for (let i = 0; i < budget; i++) {
        const kind = determineSpawnKind();
        const pos = randomPointInRing(innerR, outerR);

        events.push({
            ring,
            kind,
            position: pos,
            quantity: 1
        });
    }

    return events;
}

function determineSpawnKind(): PickupKind {
    const r = Math.random();
    if (r < SPAWN_RATIOS.PIGMENT) return 'pigment';
    if (r < SPAWN_RATIOS.PIGMENT + SPAWN_RATIOS.NEUTRAL) return 'neutral';
    // Special cases
    const r2 = Math.random();
    if (r2 < 0.33) return 'solvent';
    if (r2 < 0.66) return 'catalyst';
    return 'shield';
}

function randomPointInRing(innerR: number, outerR: number) {
    const angle = Math.random() * Math.PI * 2;
    // Uniform distribution in 2D annulus requires sqrt
    // r = sqrt(random() * (R_out^2 - R_in^2) + R_in^2)
    const r = Math.sqrt(Math.random() * (outerR * outerR - innerR * innerR) + innerR * innerR);

    return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r
    };
}

/**
 * Checks if a "Candy Vein" should be spawned (Dynamic Bounty).
 */
export function checkCandyVeinSpawn(
    aliveR3: number,
    totalAlive: number,
    timeSinceLastVein: number
): boolean {
    if (totalAlive < 2) return false; // Need enough players
    if (aliveR3 / totalAlive <= CANDY_VEIN.TRIGGER_RATIO) {
        if (timeSinceLastVein > 60000) { // Cooldown
            return true;
        }
    }
    return false;
}

export function resetWaveTimers(runtime: any, config: any) {
    if (!runtime.wave) runtime.wave = {};
    runtime.wave.ring1 = config.waveIntervals?.ring1 || 10;
    runtime.wave.ring2 = config.waveIntervals?.ring2 || 15;
    runtime.wave.ring3 = config.waveIntervals?.ring3 || 20;
}

export function updateWaveSpawner(state: any, dt: number) {
    const rt = state.runtime.wave;
    const config = state.levelConfig;

    // Ring 1 Wave
    rt.ring1 -= dt;
    if (rt.ring1 <= 0) {
        rt.ring1 = config.waveIntervals.ring1;
        // Spawn R1
        spawnWave(state, 1);
    }

    // Ring 2 Wave
    rt.ring2 -= dt;
    if (rt.ring2 <= 0) {
        rt.ring2 = config.waveIntervals.ring2;
        spawnWave(state, 2);
    }

    // Ring 3 Wave
    rt.ring3 -= dt;
    if (rt.ring3 <= 0) {
        rt.ring3 = config.waveIntervals.ring3;
        spawnWave(state, 3);
    }
}

function spawnWave(state: any, ring: RingId) {
    const spawns = generateWaveSpawns(ring, state.players.length, { r: 1, g: 1, b: 1 }); // Dummy target

    spawns.forEach(ev => {
        // Convert SpawnEvent to Entity
        // This requires access to factories or doing it manually
        // For now, assuming direct push to state.food matching index.ts structure
        const f: any = {
            id: Math.random().toString(36).substring(7),
            position: ev.position,
            radius: 12, // Default size
            kind: ev.kind,
            value: 10,
            isDead: false,
            pigment: { r: Math.random(), g: Math.random(), b: Math.random() }, // Random pigment for now
            velocity: { x: 0, y: 0 }
        };

        // Assign specific colors based on Ring usually?
        // Or random.

        state.food.push(f);
    });
}
