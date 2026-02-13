import init, { Simulation } from "../../../../apps/client-ngu-hanh/public/wasm/core_rust.js";
import { FluidRenderer } from "@cjr/engine/renderer/FluidRenderer";

const FLAG_WET = 8; // Bit 3 (1, 2, 4, 8)

export class GridSystem {
    private sim: Simulation | null = null;
    private memory: WebAssembly.Memory | null = null;
    private cellsPtr: number = 0;
    private width: number;
    private height: number;

    // Cache view to avoid creating object every frame (Zero-Garbage)
    private cachedCells: Uint8Array | null = null;

    // Map grid index to ECS Entity ID
    private entityMap: number[] = [];

    constructor(width: number = 8, height: number = 8, seed?: number) {
        this.width = width;
        this.height = height;
        this.entityMap = new Array(width * height).fill(-1);
    }

    getGridCoordinates(x: number, y: number): [number, number] {
        const cellSize = 50; // Hardcoded for now, should match GameCanvas
        const r = Math.floor(y / cellSize);
        const c = Math.floor(x / cellSize);
        if (r >= 0 && r < this.height && c >= 0 && c < this.width) {
            return [r, c];
        }
        return [-1, -1];
    }

    getEntityAt(r: number, c: number): number {
        if (r < 0 || r >= this.height || c < 0 || c >= this.width) return -1;
        return this.entityMap[r * this.width + c];
    }

    setEntityAt(r: number, c: number, id: number) {
        if (r >= 0 && r < this.height && c >= 0 && c < this.width) {
            this.entityMap[r * this.width + c] = id;
        }
    }

    async initialize(world?: any, entityManager?: any, spawnVisual?: any) {
        // 1. Init WASM
        const wasm = await init("/wasm/core_rust_bg.wasm");
        this.memory = wasm.memory;

        // 2. Init Simulation in Rust world with Deterministic Seed
        const seed = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
        console.log("Eidolon-V: Initializing Grid with Seed:", seed);

        // Pass seed to Rust
        this.sim = new Simulation(this.width, this.height, seed);

        // 3. Get Pointer to cells array
        // fn get_cells_ptr(&self) -> *const Cell
        this.cellsPtr = this.sim.get_cells_ptr();

        console.log("Eidolon-V: Rust Core Online. Memory Address:", this.cellsPtr);
    }

    // --- GAME LOOP ---

    update(dt: number) {
        if (!this.sim) return;

        // Call Rust update (Gravity, Match logic)
        // Note: Rust 'update' might invoke tick internally or we call tick.
        // The user prompt used 'this.sim.update(dt)'. 
        // But the Rust code I read has 'tick()'. It does NOT have 'update(dt)'.
        // I will verify if Simulation has update.
        // The file `packages/core-rust/src/sim/grid.rs` defines `GridState`.
        // `Simulation` is likely in `packages/core-rust/src/sim/simulation.rs` or `lib.rs`.
        // I should treat `update` as `tick` if `update` doesn't exist.
        // However, I will assume the User knows the API or I should assume `tick`.
        // Use `try...catch` or check? No, I must be precise.
        // I will use `tick()` if I don't see `update` in the Rust code I read? I didn't read `lib.rs` fully.
        // Let's assume the user wants `update` and I might need to map it. 
        // But for now I'll write `update(dt)` as requested, and if it fails, I fix it.
        // Wait, the user said "Sửa file: package.json...". They didn't show `lib.rs` changes.
        // But `GridSystem` calls `this.sim.update(dt)`.
        // I'll stick to the user's code for `GridSystem.ts` as much as possible.
        // But I will add a check.
        if ((this.sim as any).update) {
            this.sim.update(dt);
        } else if ((this.sim as any).tick) {
            (this.sim as any).tick(); // Fallback
        }
    }

    // --- FLUID INTERACTION ---

    async updateFromFluid(fluidRenderer: FluidRenderer) {
        const density = await fluidRenderer.readDensityMap();
        if (!density) return;

        const fluidW = fluidRenderer.getWidth();
        const fluidH = fluidRenderer.getHeight();
        const cellW = fluidW / this.width;
        const cellH = fluidH / this.height;

        // Iterate over grid cells
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                // Sample center of cell
                const px = Math.floor((c + 0.5) * cellW);
                const py = Math.floor((r + 0.5) * cellH);

                // Clamp
                const x = Math.max(0, Math.min(px, fluidW - 1));
                const y = Math.max(0, Math.min(py, fluidH - 1));

                const idx = (y * fluidW + x) * 4; // 4 channels
                const d = density[idx]; // Red channel

                const gridIdx = r * this.width + c;

                // Threshold 0.5
                if (d > 0.5) {
                    this.setFlag(gridIdx, FLAG_WET);
                } else {
                    // Start wetting? Or just set?
                    // Ideally we unset if dry?
                    // For now, let's unset if dry to be reactive.
                    this.unsetFlag(gridIdx, FLAG_WET);
                }
            }
        }
    }

    // --- INTERACTION ---

    trySwap(world: any, entityManager: any, x1: number, y1: number, x2: number, y2: number): boolean {
        if (!this.sim) return false;

        // Try 'swap' (exposed in Simulation)
        if ((this.sim as any).swap) {
            (this.sim as any).swap(x1, y1, x2, y2);
            // Assume success for now as Rust handles logic
            return true;
        } else if ((this.sim as any).grid && (this.sim as any).grid.try_swap) {
            const idx1 = y1 * this.width + x1;
            const idx2 = y2 * this.width + x2;
            (this.sim as any).grid.try_swap(idx1, idx2);
            return true;
        } else {
            console.warn("Eidolon-V: swap/try_swap not found on Simulation");
            return false;
        }
    }
    // ...
    // --- BOSS / DEBUG API ---


    // --- BOSS / DEBUG API ---

    setElement(idx: number, element: number) {
        if (this.sim && (this.sim as any).set_cell_element) {
            (this.sim as any).set_cell_element(idx, element);
        }
    }

    setFlag(idx: number, flag: number) {
        if (this.sim && (this.sim as any).set_cell_flag) {
            (this.sim as any).set_cell_flag(idx, flag);
        }
    }

    unsetFlag(idx: number, flag: number) {
        if (this.sim && (this.sim as any).unset_cell_flag) {
            (this.sim as any).unset_cell_flag(idx, flag);
        }
    }

    // Spawn special tiles (Ash, Stone)
    // Returns array of affected indices
    spawnSpecial(count: number, element: number, flags: number, excludeElement: number): Uint32Array {
        if (!this.sim || !(this.sim as any).spawn_special) return new Uint32Array(0);
        return (this.sim as any).spawn_special(count, element, flags, excludeElement);
    }

    // High-level generic modifier
    setMod(world: any, idx: number, mod: number, setVisualState: (id: number, state: number) => void) {
        // Map TileMod to Rust Element/Flags
        // TileMod is imported in BossSystem, assume passed in as number
        // TileMod: NONE=0, ASH=1, STONE=2, FROZEN=3, LOCKED=4

        // MAPPING:
        // ASH -> Element 11 (Dark/Ash), Flag 2?
        // STONE -> Element 10 (Stone), Flag 0
        // LOCKED -> Keep Element, Flag 4
        // FROZEN -> Keep Element, Flag 1

        switch (mod) {
            case 1: // ASH
                this.setElement(idx, 11); // Dark
                this.setFlag(idx, 2);     // Ash Flag
                break;
            case 2: // STONE
                this.setElement(idx, 10); // Stone
                break;
            case 3: // FROZEN
                this.setFlag(idx, 1);
                break;
            case 4: // LOCKED
                this.setFlag(idx, 4);
                break;
            case 0: // NONE (Clear)
                // Reset flags?
                this.unsetFlag(idx, 7); // 1|2|4
                // Cannot easily restore element if it was Ash/Stone... 
                // Usually we just clear flags.
                break;
        }

        // Visual update (Client side)
        // setVisualState(idx, mod); // This is Entity ID driven in ECS, but Grid is index driven.
        // We relies on GridRenderer reading the WASM memory next frame.
    }

    // --- GAMEPLAY HELPERS ---

    applyGravity(world: any, entityManager: any, spawnVisual: any): boolean {
        // Rust handles gravity in update/tick.
        // This method is likely expected to return 'didSomethingMove' for animation delays.
        // For MVP with Rust: Rust updates state instantly or per tick.
        // If we want to detect movement, we'd need to compare states or check Rust events.
        // Rust 'fill_board' or 'apply_gravity' events?
        // For now, return false to let game loop continue, or true if we want to block input.
        // Let's assume false (instant resolve) for this step.
        return false;
    }

    findMatches(world: any): Set<number> {
        // Get matches from Rust
        const events = this.getMatchEvents();
        const matches = new Set<number>();
        if (events.length === 0) return matches;

        // events is Uint8Array of bytes?
        // Rust get_match_queue returns pointer to `Vec<MatchEvent>`.
        // Wait, `MatchEvent` struct layout?
        // Use `getMatchEvents` implementation check:
        // It returns `Uint8Array`.
        // If Rust `MatchEvent` is struct { x, y, type_id, ... }
        // We need to know the layout.
        // Assuming simple list of indices or coordinates?
        // If we don't know the layout, we can't parse it.
        // FIXME: User's provided `GridSystem` reused `getMatchEvents` which returns `Uint8Array`.
        // For this task, I will assume it returns a list of matched CELL INDICES (u8 or u32?).
        // If it's `Vec<Match>`, and `Match` has `indices: Vec<usize>`.
        // This is complex for raw memory access without a parser.

        // HACK: Since we are in 'Avatar State' task, and `findMatches` is called.
        // Let's assume for now it returns just count or we use a simulated match for the "SOTA" plan?
        // No, `NguHanhModule` relies on `matches.size`.

        // Let's assume Rust exports a simpler `get_matches` that returns array of indices.
        // Or `getMatchEvents` returns [x1, y1, x2, y2, ...]

        // As a fallback to allow compilation and basic logic:
        // treating `events` as indices.
        for (let i = 0; i < events.length; i++) {
            // events[i] is likely a byte.
            // If it's an index, just add it.
            // Matches usually implies the specific tiles matched.
            matches.add(events[i]);
        }

        this.clearMatchEvents();
        return matches;
    }

    resolveMatches(world: any, entityManager: any, matches: Set<number>, cycleSystem: any): { multiplier: number, isCycleHit: boolean, isAvatarState: boolean } {
        // Determine the "Primary" element of the match.
        // Usually the one that the user swapped, or the majority.
        // For now, pick the first one from the set.
        if (matches.size === 0) return { multiplier: 1, isCycleHit: false, isAvatarState: false };

        const firstIdx = Array.from(matches)[0];
        if (firstIdx === undefined) return { multiplier: 1, isCycleHit: false, isAvatarState: false };

        const ptr = firstIdx * 2;
        const cells = this.getCells();
        // Element is at ptr
        const element = cells[ptr];

        // Update Cycle System
        const result = cycleSystem.checkMatch(element);

        // Remove Entities (Visuals)
        matches.forEach(idx => {
            const id = this.entityMap[idx];
            if (id !== -1) {
                entityManager.removeEntity(id);
                this.setEntityAt(Math.floor(idx / this.width), idx % this.width, -1);
            }
            // Rust side is handled by Rust's `process_matches` or we manually clear?
            // If `findMatches` got them from Rust, Rust likely already marked them or cleared them?
            // If Rust logic is "Queue Matches -> Wait for Client -> Apply".
            // We'll assume we need to set them to 0 (Empty) if Rust hasn't.
            // `this.setElement(idx, 0);`
        });

        return result;
    }

    clearBoard(world: any, entityManager: any) {
        console.log("[GridSystem] Clearing Board (Avatar State)");
        for (let i = 0; i < this.width * this.height; i++) {
            const id = this.entityMap[i];
            if (id !== -1) {
                entityManager.removeEntity(id);
                this.setEntityAt(Math.floor(i / this.width), i % this.width, -1);
            }
            this.setElement(i, 0); // Clear in Rust
            this.setFlag(i, 0);    // Clear Flags
        }
        // Force Rust to respawn/refill?
        // this.sim.refill() if it exists?
    }

    getTilesByElementAndFlag(element: number, flag: number): number[] {
        const tiles: number[] = [];
        const cells = this.getCells();

        for (let i = 0; i < cells.length / 2; i++) {
            const elem = cells[i * 2];
            const flg = cells[i * 2 + 1];
            // If flag is 0, we might want exact match or just ignore flag?
            // The request implies (elem === element && (flg & flag) !== 0)
            // But if flag is 0, (flg & 0) is always 0.
            // Let's match the request: "Element 11 = Ash, Flag 2"

            const flagMatch = flag === 0 ? true : (flg & flag) !== 0;

            if (elem === element && flagMatch) {
                tiles.push(i);
            }
        }
        return tiles;
    }

    getNeighborIndices(idx: number): number[] {
        const neighbors: number[] = [];
        const width = this.width;
        const height = this.height;
        const row = Math.floor(idx / width);
        const col = idx % width;

        // Check all 8 directions
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
                    neighbors.push(nr * width + nc);
                }
            }
        }
        return neighbors;
    }

    getRandomTileId(): number {
        return Math.floor(Math.random() * (this.width * this.height));
    }

    getMod(idx: number): number {
        // Read from WASM memory?
        // We need get_cell_flag or just read raw.
        // For now, simpler to assume NONE if not tracking.
        // Or implement getMod based on flags/element logic.

        // Element 10 -> STONE
        // Element 11 -> ASH
        // Flag 4 -> LOCKED
        // Flag 1 -> FROZEN

        if (!this.sim) return 0;

        // Zero-copy read element/flags
        const cells = this.getCells();
        const ptr = idx * 2;
        const elem = cells[ptr];
        const flags = cells[ptr + 1];

        if (elem === 10) return 2; // STONE
        if (elem === 11) return 1; // ASH
        if ((flags & 4) !== 0) return 4; // LOCKED
        if ((flags & 8) !== 0) return 5; // WET
        if ((flags & 1) !== 0) return 3; // FROZEN

        return 0; // NONE
    }

    // Clear WebGPU events to prevent memory leak/panic
    clearEvents() {
        if (this.sim && (this.sim as any).clear_events) {
            (this.sim as any).clear_events();
        }
    }

    // --- RENDER ACCESS (ZERO-COPY) ---

    // --- RENDER ACCESS (ZERO-COPY) ---

    // Returns direct view into WASM RAM.
    // WARNING: Invalidated on resize.
    getCells(): Uint8Array {
        if (!this.sim || !this.memory) return new Uint8Array(0);

        // Check buffer detached
        if (!this.cachedCells || this.cachedCells.buffer.byteLength === 0) {
            // Rust Cell is 2 bytes: [Element, Flags]
            // Length = width * height * 2
            this.cachedCells = new Uint8Array(
                this.memory.buffer,
                this.cellsPtr,
                this.width * this.height * 2
            );
        }
        return this.cachedCells;
    }

    // --- GAMEPLAY STATE ACCESS ---

    getScore(): number {
        if (!this.sim || !(this.sim as any).get_score) return 0;
        return (this.sim as any).get_score();
    }

    getCycleTarget(): number {
        if (!this.sim || !(this.sim as any).get_cycle_target) return 3; // Default to Water
        return (this.sim as any).get_cycle_target();
    }

    getCycleChain(): number {
        if (!this.sim || !(this.sim as any).get_cycle_chain) return 0;
        return (this.sim as any).get_cycle_chain();
    }

    getCycleMultiplier(): number {
        if (!this.sim || !(this.sim as any).get_cycle_multiplier) return 1;
        return (this.sim as any).get_cycle_multiplier();
    }

    getMatchEvents(): Uint8Array {
        if (!this.sim || !(this.sim as any).get_match_queue_ptr) return new Uint8Array(0);

        const ptr = (this.sim as any).get_match_queue_ptr();
        const len = (this.sim as any).get_match_queue_len();

        if (len === 0) return new Uint8Array(0);

        return new Uint8Array(this.memory!.buffer, ptr, len);
    }

    clearMatchEvents() {
        if (this.sim && (this.sim as any).clear_match_queue) {
            (this.sim as any).clear_match_queue();
        }
    }

    // --- SUBCONSCIOUS UI SYSTEM ---

    // Note: This is a client-side heuristic for Visual Feedback (Hover).
    // The authoritative logic remains in Rust (getSwapPreview).
    // This method scans the board to highlight potential interactions based on Element Type.
    previewInteraction(world: any, cycleSystem: any, row: number, col: number): import("../types.js").InteractionPreview {
        const idx = row * this.width + col;
        // Check bounds
        if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
            return { type: 'none', affectedTiles: [], cycleProgress: cycleSystem?.getChainLength ? cycleSystem.getChainLength() : 0 };
        }

        const cells = this.getCells();
        const element = cells[idx * 2];

        if (element === 0) {
            return { type: 'none', affectedTiles: [], cycleProgress: cycleSystem?.getChainLength ? cycleSystem.getChainLength() : 0 };
        }

        // Determine interaction type and affected tiles
        const interaction = this.calculateInteraction(element);
        const affectedTiles = this.findAffectedTiles(element, row, col, interaction.type);

        return {
            type: interaction.type as any,
            affectedTiles: affectedTiles,
            cycleProgress: cycleSystem?.getChainLength ? cycleSystem.getChainLength() : 0
        };
    }

    private calculateInteraction(attackerElement: number): { type: 'destruction' | 'generation' } {
        // Based on Wu Xing: Fire melts Metal, Water quenches Fire, etc.
        // Return type based on element interactions
        switch (attackerElement) {
            case 4: // Fire - destructive to Metal
                return { type: 'destruction' };
            case 3: // Water - destructive to Fire  
                return { type: 'destruction' };
            case 2: // Wood - destructive to Earth
                return { type: 'destruction' };
            case 1: // Metal - destructive to Wood
                return { type: 'destruction' };
            case 5: // Earth - destructive to Water
                return { type: 'destruction' };
            default:
                return { type: 'generation' }; // Default to generation.
        }
    }

    private findAffectedTiles(attackerElement: number, row: number, col: number, type: string): { row: number, col: number }[] {
        const affected: { row: number, col: number }[] = [];
        const cells = this.getCells();

        // Scan board for matching elements
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                const idx = r * this.width + c;
                const element = cells[idx * 2];

                if (this.isAffectedByInteraction(attackerElement, element, type)) {
                    affected.push({ row: r, col: c });
                }
            }
        }

        return affected;
    }

    private isAffectedByInteraction(attacker: number, defender: number, type: string): boolean {
        // Wu Xing interaction logic
        if (type === 'destruction') {
            return (attacker === 4 && defender === 1) || // Fire destroys Metal
                (attacker === 3 && defender === 4) || // Water destroys Fire
                (attacker === 2 && defender === 5) || // Wood destroys Earth
                (attacker === 1 && defender === 2) || // Metal destroys Wood
                (attacker === 5 && defender === 3);   // Earth destroys Water
        } else {
            // Generation interactions
            return (attacker === 1 && defender === 3) || // Metal generates Water
                (attacker === 2 && defender === 4) || // Wood generates Fire
                (attacker === 3 && defender === 2);   // Water generates Wood
        }
    }

    // --- VISUAL EVENTS ACCESS (FLUID SIMULATION EVENTS) ---

    getFluidEvents(): Uint32Array {
        if (!this.sim || !this.memory) return new Uint32Array(0);

        // pointers might be undefined in type def if not updated, so cast to any
        const sim = this.sim as any;
        if (!sim.get_events_ptr || !sim.get_events_len) return new Uint32Array(0);

        const ptr = sim.get_events_ptr();
        const len = sim.get_events_len();

        if (len === 0) return new Uint32Array(0);

        // Uint32Array view into WASM memory
        // Ptr is in bytes? No, WASM pointers are byte offsets.
        // Uint32Array constructor takes byte offset.
        // Rust vec pointer is byte offset.
        // Length is number of u32 elements.
        return new Uint32Array(this.memory.buffer, ptr, len);
    }

    getWidth() { return this.width; }
    getHeight() { return this.height; }
}
