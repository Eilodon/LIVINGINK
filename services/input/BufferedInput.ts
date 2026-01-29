import { InputStore } from '../engine/dod/ComponentStores';

// EIDOLON-V FIX: Input types and interfaces
export type InputEventType = 'keydown' | 'keyup' | 'mousedown' | 'mouseup' | 'mousemove' | 'wheel' | 'touch';

export interface InputEvent {
    type: InputEventType;
    key?: string;
    button?: number;
    x?: number;
    y?: number;
    deltaX?: number;
    deltaY?: number;
    timestamp: number;
}

// EIDOLON-V FIX: Ring buffer for input events
export class InputRingBuffer {
    private buffer: InputEvent[];
    private size: number;
    private head: number = 0;
    private tail: number = 0;
    private frameNumber: number = 0;
    private frameStartIndices: number[] = [];

    constructor(size: number = 1024) {
        this.size = size;
        this.buffer = new Array(size);
    }

    // EIDOLON-V FIX: Add event to buffer
    add(event: Omit<InputEvent, 'timestamp'>): void {
        const fullEvent: InputEvent = {
            ...event,
            timestamp: performance.now()
        };

        this.buffer[this.head] = fullEvent;
        this.head = (this.head + 1) % this.size;

        if (this.head === this.tail) {
            this.tail = (this.tail + 1) % this.size; // Overwrite oldest
        }
    }

    // EIDOLON-V FIX: Mark start of new frame
    advanceFrame(): void {
        this.frameNumber++;
        this.frameStartIndices[this.frameNumber] = this.head;

        // Cleanup old frame indices
        if (this.frameStartIndices.length > 60) {
            delete this.frameStartIndices[this.frameNumber - 60];
        }
    }

    // EIDOLON-V FIX: Get events since stored frame index
    getEventsSince(lastFrameIndex: number): InputEvent[] {
        const events: InputEvent[] = [];
        // Simplified: return empty for now, ring buffer query not needed for current use case
        return events;
    }

    // EIDOLON-V P3: Cleanup method
    clear(): void {
        this.head = 0;
        this.tail = 0;
        this.frameNumber = 0;
        this.frameStartIndices = [];
    }
}

// EIDOLON-V FIX: Input state manager
export class BufferedInput {
    private static instance: BufferedInput | null = null;
    private keys: Set<string> = new Set();
    private mouse: { x: number; y: number } = { x: 0, y: 0 };
    private isMouseDown: boolean = false;
    private isDisposed: boolean = false;

    // EIDOLON-V P3: Store handler references for proper cleanup
    private keyDownHandler: (e: KeyboardEvent) => void;
    private keyUpHandler: (e: KeyboardEvent) => void;
    private mouseMoveHandler: (e: MouseEvent) => void;
    private mouseDownHandler: () => void;
    private mouseUpHandler: () => void;

    // EIDOLON-V: Map helper
    private keyMap: Record<string, string> = {
        'KeyW': 'up', 'ArrowUp': 'up',
        'KeyS': 'down', 'ArrowDown': 'down',
        'KeyA': 'left', 'ArrowLeft': 'left',
        'KeyD': 'right', 'ArrowRight': 'right',
        'Space': 'skill',
        'KeyQ': 'eject', 'KeyE': 'eject'
    };

    private constructor() {
        // EIDOLON-V P3: Bind handlers with stored references
        this.keyDownHandler = (e: KeyboardEvent) => {
            this.keys.add(e.code);
        };
        this.keyUpHandler = (e: KeyboardEvent) => {
            this.keys.delete(e.code);
        };
        this.mouseMoveHandler = (e: MouseEvent) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        };
        this.mouseDownHandler = () => {
            this.isMouseDown = true;
        };
        this.mouseUpHandler = () => {
            this.isMouseDown = false;
        };

        this.setupEventListeners();
    }

    static getInstance(): BufferedInput {
        if (!BufferedInput.instance) {
            BufferedInput.instance = new BufferedInput();
        }
        return BufferedInput.instance;
    }

    private setupEventListeners(): void {
        // EIDOLON-V P3: Guard for SSR/Node.js environment
        if (typeof window === 'undefined') return;

        // Use stored handler references
        window.addEventListener('keydown', this.keyDownHandler);
        window.addEventListener('keyup', this.keyUpHandler);
        window.addEventListener('mousemove', this.mouseMoveHandler);
        window.addEventListener('mousedown', this.mouseDownHandler);
        window.addEventListener('mouseup', this.mouseUpHandler);
    }

    // EIDOLON-V P3: Proper cleanup to prevent memory leaks
    public dispose(): void {
        if (this.isDisposed) return;

        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this.keyDownHandler);
            window.removeEventListener('keyup', this.keyUpHandler);
            window.removeEventListener('mousemove', this.mouseMoveHandler);
            window.removeEventListener('mousedown', this.mouseDownHandler);
            window.removeEventListener('mouseup', this.mouseUpHandler);
        }

        this.keys.clear();
        this.isDisposed = true;
        BufferedInput.instance = null;
    }

    // EIDOLON-V FIX: Direct Sync to DOD Store
    public syncToStore(entityIndex: number): void {
        if (this.isDisposed) return;

        // 1. Mouse Position -> Target
        InputStore.setTarget(entityIndex, this.mouse.x, this.mouse.y);

        // 2. Skill Action (Space or Mouse Down)
        const isSkill = this.keys.has('Space') || this.isMouseDown;
        InputStore.setSkillActive(entityIndex, isSkill);

        // 3. Eject Action (Q or E)
        const isEject = this.keys.has('KeyQ') || this.keys.has('KeyE');
        InputStore.setEjectActive(entityIndex, isEject);
    }

    // EIDOLON-V P3: Reset state without removing listeners
    public reset(): void {
        this.keys.clear();
        this.isMouseDown = false;
    }

    // EIDOLON-V P3: Getters for debugging
    public getMousePosition(): { x: number; y: number } {
        return { ...this.mouse };
    }

    public isKeyPressed(code: string): boolean {
        return this.keys.has(code);
    }
}
