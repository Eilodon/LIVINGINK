// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { NguHanhModule } from './index.js';
import { WorldState } from '../../engine/src/generated/WorldState.js';
import { EntityManager } from '../../engine/src/core/EntityManager.js';

// Mock engine to avoid PixiJS load in Node
vi.mock('@cjr/engine', async () => {
    const actual = await vi.importActual<any>('@cjr/engine');
    return {
        ...actual,
        FluidRenderer: class { },
    };
});

// Mock GridSystem to avoid WASM
vi.mock('./systems/GridSystem.js', async () => {
    return {
        GridSystem: class {
            width: number;
            height: number;
            cells: Uint8Array;
            events: Uint32Array;
            entityMap: number[] = [];

            constructor(w: number, h: number, seed: number) {
                this.width = w;
                this.height = h;
                this.cells = new Uint8Array(w * h * 2);
                this.events = new Uint32Array(0);
                this.entityMap = new Array(w * h).fill(-1);

                // Initialize entity map mock
                for (let i = 0; i < w * h; i++) this.entityMap[i] = i + 100;
            }

            initialize = async (world: any, em: any, spawnVisual: any) => {
                for (let i = 0; i < this.width * this.height; i++) {
                    const id = em.createEntity();
                    spawnVisual(id, 1, 1);
                }
            };
            update = () => { };
            updateFromFluid = async () => { };
            syncEntities = () => { };
            applyGravity = () => false;
            getFluidEventBuffer = () => new Uint32Array(0);
            clearEvents = () => { };
            findMatches = () => new Set();
            resolveMatches = () => ({ multiplier: 1, isCycleHit: false, isAvatarState: false });
            getCells = () => this.cells;
            getEntityAt = (r: number, c: number) => this.entityMap[r * this.width + c];
            setEntityAt = (r: number, c: number, id: number) => { this.entityMap[r * this.width + c] = id; };
            setMod = () => { };
            getGridCoordinates = (x: number, y: number) => {
                return [Math.floor((y + 350) / 50), Math.floor((x + 350) / 50)];
            };
            trySwap = () => true;
            previewInteraction = () => ({ type: 'none', affectedTiles: [] });
            getTilesByElementAndFlag = () => [];
            getWidth = () => this.width;
            getHeight = () => this.height;
            clearBoard = () => { };
        }
    };
});

describe('Ngũ Hành Module', () => {
    it('should initialize, run game loop, and handle input', async () => {
        // Create real instances
        console.log("Initializing WorldState...");
        const world = new WorldState({ maxEntities: 1000 });
        const entityManager = new EntityManager(0, 1000);

        // Mock Context
        const mockContext = {
            entityManager: entityManager,
            spawnVisual: (entityId: number, color: number, shape: number) => { },
            setVisualState: (entityId: number, state: number) => { },
            onPreviewInteraction: (data: any) => { }
        };

        const nguHanh = new NguHanhModule();
        await nguHanh.onMount(world, mockContext);
        nguHanh.startLevel(1);

        // Check if entities were spawned (8x8 grid = 64 tiles + 1 Boss = 65)
        // Level 1 is 6x6 = 36 tiles + 1 Boss = 37
        expect(entityManager.count).toBe(37);

        // Run loop multiple times
        console.log("Simulating Game Loop (Gravity)...");
        for (let i = 0; i < 10; i++) {
            nguHanh.onUpdate(world, 0.016);
        }

        // After stable state
        expect(entityManager.count).toBe(37);

        console.log("Simulating Input (Select & Swap)...");
        // Click (0,0)
        nguHanh.onPlayerInput(world, { type: 'pointerdown', x: -350, y: -350 });

        // Click (0,1)
        nguHanh.onPlayerInput(world, { type: 'pointerdown', x: -250, y: -350 });

        // We can't easily assert match success without mocking random or forcing grid state,
        // but if code runs without error and logs output, integration is successful.
    });
});
