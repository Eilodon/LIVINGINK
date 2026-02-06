import { InputStore, InputAccess, WorldState, STRIDES } from '@cjr/engine';

// ... (existing imports)

// EIDOLON-V FIX: Input types and interfaces
export type InputEventType =
  | 'keydown'
  | 'keyup'
  | 'mousedown'
  | 'mouseup'
  | 'mousemove'
  | 'wheel'
  | 'touch';

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
      timestamp: performance.now(),
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
    const startIndex = this.frameStartIndices[lastFrameIndex];
    if (startIndex === undefined) return [];

    // Number of elements currently in the buffer (head === tail means empty)
    const count = (this.head - this.tail + this.size) % this.size;
    if (count === 0) return [];

    // Validate that startIndex is still within the retained window; otherwise clamp to tail.
    const distanceFromTail = (startIndex - this.tail + this.size) % this.size;
    let current = distanceFromTail < count ? startIndex : this.tail;

    const events: InputEvent[] = [];
    while (current !== this.head) {
      const ev = this.buffer[current];
      if (ev) events.push(ev);
      current = (current + 1) % this.size;
    }

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
    KeyW: 'up',
    ArrowUp: 'up',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    Space: 'skill',
    KeyQ: 'eject',
    KeyE: 'eject',
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

  // EIDOLON-V FIX: Direct Sync to DOD Store (IoC)
  public syncToStore(
    entityIndex: number,
    playerPosition?: { x: number; y: number },
    camera?: { x: number; y: number },
    world: WorldState | null = null
  ): void {
    if (this.isDisposed) return;

    // 1. Mouse Position -> Target (Convert screen to world coordinates)
    let targetX = this.mouse.x;
    let targetY = this.mouse.y;

    // Convert screen coordinates to world coordinates if camera is provided
    if (camera && playerPosition) {
      // Screen center relative coordinates
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      const worldX = camera.x + (this.mouse.x - screenCenterX);
      const worldY = camera.y + (this.mouse.y - screenCenterY);
      targetX = worldX;
      targetY = worldY;
    }

    if (world) {
      // EIDOLON-V: Use WorldState accessors
      InputAccess.setTargetX(world, entityIndex, targetX);
      InputAccess.setTargetY(world, entityIndex, targetY);

      // 2. Skill Action (Space or Mouse Down)
      const isSkill = this.keys.has('Space') || this.isMouseDown;

      // 3. Eject Action (Q or E)
      const isEject = this.keys.has('KeyQ') || this.keys.has('KeyE');

      // Direct bit manipulation using DataView (mimicking InputStore logic but with IoC)
      const offset = entityIndex * STRIDES.INPUT * 4 + 8;
      let actions = world.inputView.getUint32(offset, true);

      if (isSkill) actions |= 1; else actions &= ~1;
      if (isEject) actions |= 2; else actions &= ~2;

      world.inputView.setUint32(offset, actions, true);

    } else {
      console.warn('[BufferedInput] syncToStore called without WorldState - input dropped');
    }
  }

  // EIDOLON-V P3: Reset state without removing listeners
  public reset(): void {
    this.keys.clear();
    this.isMouseDown = false;
    this.joystickVector.x = 0;
    this.joystickVector.y = 0;
    this.eventQueue = [];
  }

  // EIDOLON-V P3: Getters for debugging
  public getMousePosition(): { x: number; y: number } {
    return { ...this.mouse };
  }

  public isKeyPressed(code: string): boolean {
    return this.keys.has(code);
  }

  // ============================================
  // EIDOLON-V: InputManager Compatibility Layer
  // Merged from InputManager.ts for unified input
  // ============================================

  private joystickVector = { x: 0, y: 0 };
  private eventQueue: { type: string; timestamp: number }[] = [];
  private sharedInputBuffer = new Float32Array(2);

  // Static init for legacy compatibility
  public static init(): void {
    BufferedInput.getInstance();
  }

  // Virtual joystick support (MobileControls, ScreenManager)
  public setJoystick(x: number, y: number): void {
    if (this.isDisposed) return;
    this.joystickVector.x = x;
    this.joystickVector.y = y;
    this.updateMoveVector();
  }

  // Button support (skill, eject)
  public setButton(btn: 'skill' | 'eject', isDown: boolean): void {
    if (this.isDisposed) return;
    if (btn === 'skill') {
      if (isDown) this.keys.add('Space');
      else this.keys.delete('Space');
      if (isDown) this.pushEvent('skill');
    }
    if (btn === 'eject') {
      if (isDown) this.keys.add('KeyQ');
      else this.keys.delete('KeyQ');
      if (isDown) this.pushEvent('eject');
    }
  }

  // Event queue for legacy GameStateManager
  private pushEvent(type: string): void {
    this.eventQueue.push({ type, timestamp: Date.now() });
  }

  public popEvents(): { type: string; timestamp: number }[] {
    const events = this.eventQueue;
    this.eventQueue = [];
    return events;
  }

  // Move vector calculation (keyboard + joystick hybrid)
  private updateMoveVector(): void {
    let jx = 0, jy = 0;

    // Priority: Joystick if active
    if (Math.abs(this.joystickVector.x) > 0.01 || Math.abs(this.joystickVector.y) > 0.01) {
      jx = this.joystickVector.x;
      jy = this.joystickVector.y;
      const len = Math.sqrt(jx * jx + jy * jy);
      if (len > 1) { jx /= len; jy /= len; }
    } else {
      // Fallback: Keyboard WASD
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) jy -= 1;
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) jy += 1;
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) jx -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) jx += 1;
      const len = Math.sqrt(jx * jx + jy * jy);
      if (len > 0) { jx /= len; jy /= len; }
    }

    this.sharedInputBuffer[0] = jx;
    this.sharedInputBuffer[1] = jy;
  }

  // Legacy target position update (zero-allocation)
  public updateTargetPosition(currentPos: { x: number; y: number }, outTarget: { x: number; y: number }): void {
    const OFFSET = 250;
    this.updateMoveVector();
    outTarget.x = currentPos.x + this.sharedInputBuffer[0] * OFFSET;
    outTarget.y = currentPos.y + this.sharedInputBuffer[1] * OFFSET;
  }

  // Actions state for legacy compatibility
  public get state() {
    return {
      actions: {
        space: this.keys.has('Space') || this.isMouseDown,
        w: this.keys.has('KeyQ') || this.keys.has('KeyE'),
      },
      events: this.eventQueue,
    };
  }
}
