// EIDOLON-V FORGE: SOTA 2026 Input Buffering System
// Frame-perfect input responsiveness - Zero input lag

export interface InputEvent {
  type: 'keydown' | 'keyup' | 'mousedown' | 'mouseup' | 'mousemove' | 'wheel';
  key?: string;
  button?: number;
  x?: number;
  y?: number;
  deltaX?: number;
  deltaY?: number;
  timestamp: number;
  frameNumber: number;
}

export interface InputState {
  keys: Set<string>;
  buttons: Set<number>;
  mouse: { x: number; y: number };
  wheel: { deltaX: number; deltaY: number };
  joystick: { x: number; y: number };
}

// EIDOLON-V FIX: Ring buffer for input events
export class InputRingBuffer {
  private buffer: InputEvent[];
  private head: number = 0;
  private tail: number = 0;
  private size: number;
  private frameNumber: number = 0;

  constructor(size: number = 256) {
    this.size = size;
    this.buffer = new Array(size);
  }

  // EIDOLON-V FIX: Add event to buffer (O(1))
  add(event: Omit<InputEvent, 'timestamp' | 'frameNumber'>): void {
    const fullEvent: InputEvent = {
      ...event,
      timestamp: performance.now(),
      frameNumber: this.frameNumber
    };

    this.buffer[this.head] = fullEvent;
    this.head = (this.head + 1) % this.size;
    
    // EIDOLON-V FIX: Overwrite oldest if full
    if (this.head === this.tail) {
      this.tail = (this.tail + 1) % this.size;
    }
  }

  // EIDOLON-V FIX: Get all events since last frame
  getEventsSince(lastFrameNumber: number): InputEvent[] {
    const events: InputEvent[] = [];
    let current = this.tail;
    
    while (current !== this.head) {
      const event = this.buffer[current];
      if (event && event.frameNumber > lastFrameNumber) {
        events.push(event);
      }
      current = (current + 1) % this.size;
    }
    
    return events;
  }

  // EIDOLON-V FIX: Get all events and clear
  getAllAndClear(): InputEvent[] {
    const events: InputEvent[] = [];
    let current = this.tail;
    
    while (current !== this.head) {
      const event = this.buffer[current];
      if (event) {
        events.push(event);
      }
      current = (current + 1) % this.size;
    }
    
    this.tail = this.head;
    return events;
  }

  // EIDOLON-V FIX: Advance frame
  advanceFrame(): void {
    this.frameNumber++;
  }

  // EIDOLON-V FIX: Clear buffer
  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.frameNumber = 0;
  }

  // EIDOLON-V FIX: Get buffer stats
  getStats() {
    const count = this.head >= this.tail ? 
      this.head - this.tail : 
      this.size - this.tail + this.head;
    
    return {
      count,
      capacity: this.size,
      frameNumber: this.frameNumber,
      utilization: count / this.size
    };
  }
}

// EIDOLON-V FIX: Input state manager
export class InputStateManager {
  private static instance: InputStateManager;
  private state: InputState;
  private buffer: InputRingBuffer;
  private lastProcessedFrame: number = 0;
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.state = {
      keys: new Set(),
      buttons: new Set(),
      mouse: { x: 0, y: 0 },
      wheel: { deltaX: 0, deltaY: 0 },
      joystick: { x: 0, y: 0 }
    };
    this.buffer = new InputRingBuffer(512);
    this.setupEventListeners();
  }

  static getInstance(): InputStateManager {
    if (!InputStateManager.instance) {
      InputStateManager.instance = new InputStateManager();
    }
    return InputStateManager.instance;
  }

  // EIDOLON-V FIX: Setup native event listeners
  private setupEventListeners(): void {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
      if (this.state.keys.has(e.code)) return; // Prevent repeat
      
      this.state.keys.add(e.code);
      this.buffer.add({
        type: 'keydown',
        key: e.code
      });
      
      this.emit('keydown', e);
    });

    window.addEventListener('keyup', (e) => {
      this.state.keys.delete(e.code);
      this.buffer.add({
        type: 'keyup',
        key: e.code
      });
      
      this.emit('keyup', e);
    });

    // Mouse events
    window.addEventListener('mousedown', (e) => {
      if (this.state.buttons.has(e.button)) return;
      
      this.state.buttons.add(e.button);
      this.buffer.add({
        type: 'mousedown',
        button: e.button,
        x: e.clientX,
        y: e.clientY
      });
      
      this.emit('mousedown', e);
    });

    window.addEventListener('mouseup', (e) => {
      this.state.buttons.delete(e.button);
      this.buffer.add({
        type: 'mouseup',
        button: e.button,
        x: e.clientX,
        y: e.clientY
      });
      
      this.emit('mouseup', e);
    });

    window.addEventListener('mousemove', (e) => {
      this.state.mouse.x = e.clientX;
      this.state.mouse.y = e.clientY;
      this.buffer.add({
        type: 'mousemove',
        x: e.clientX,
        y: e.clientY
      });
      
      this.emit('mousemove', e);
    });

    window.addEventListener('wheel', (e) => {
      this.state.wheel.deltaX += e.deltaX;
      this.state.wheel.deltaY += e.deltaY;
      this.buffer.add({
        type: 'wheel',
        deltaX: e.deltaX,
        deltaY: e.deltaY
      });
      
      this.emit('wheel', e);
    });
  }

  // EIDOLON-V FIX: Process input events for current frame
  processFrame(): InputEvent[] {
    const events = this.buffer.getEventsSince(this.lastProcessedFrame);
    this.lastProcessedFrame = this.buffer['frameNumber'];
    this.buffer.advanceFrame();
    
    // EIDOLON-V FIX: Reset wheel delta each frame
    this.state.wheel.deltaX = 0;
    this.state.wheel.deltaY = 0;
    
    return events;
  }

  // EIDOLON-V FIX: Get current input state
  getState(): InputState {
    return { ...this.state };
  }

  // EIDOLON-V FIX: Check if key is pressed
  isKeyPressed(key: string): boolean {
    return this.state.keys.has(key);
  }

  // EIDOLON-V FIX: Check if button is pressed
  isButtonPressed(button: number): boolean {
    return this.state.buttons.has(button);
  }

  // EIDOLON-V FIX: Get mouse position
  getMousePosition(): { x: number; y: number } {
    return { ...this.state.mouse };
  }

  // EIDOLON-V FIX: Get wheel delta
  getWheelDelta(): { deltaX: number; deltaY: number } {
    return { ...this.state.wheel };
  }

  // EIDOLON-V FIX: Set joystick position (for mobile/gamepad)
  setJoystick(x: number, y: number): void {
    this.state.joystick.x = Math.max(-1, Math.min(1, x)); // EIDOLON-V FIX: Inline clamp
    this.state.joystick.y = Math.max(-1, Math.min(1, y)); // EIDOLON-V FIX: Inline clamp
  }

  // EIDOLON-V FIX: Get joystick position
  getJoystick(): { x: number; y: number } {
    return { ...this.state.joystick };
  }

  // EIDOLON-V FIX: Event emitter system
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // EIDOLON-V FIX: Get performance stats
  getStats() {
    return {
      buffer: this.buffer.getStats(),
      state: {
        keysPressed: this.state.keys.size,
        buttonsPressed: this.state.buttons.size,
        mousePosition: this.state.mouse,
        joystickPosition: this.state.joystick
      },
      lastProcessedFrame: this.lastProcessedFrame
    };
  }

  // EIDOLON-V FIX: Cleanup
  dispose(): void {
    this.buffer.clear();
    this.state.keys.clear();
    this.state.buttons.clear();
    this.eventListeners.clear();
  }
}

// EIDOLON-V FIX: Input processor for game loop
export class GameInputProcessor {
  private inputManager: InputStateManager;
  private inputMap: Map<string, string> = new Map();

  constructor() {
    this.inputManager = InputStateManager.getInstance();
    this.setupDefaultInputMap();
  }

  // EIDOLON-V FIX: Setup default input mappings
  private setupDefaultInputMap(): void {
    // Movement
    this.inputMap.set('KeyW', 'up');
    this.inputMap.set('ArrowUp', 'up');
    this.inputMap.set('KeyS', 'down');
    this.inputMap.set('ArrowDown', 'down');
    this.inputMap.set('KeyA', 'left');
    this.inputMap.set('ArrowLeft', 'left');
    this.inputMap.set('KeyD', 'right');
    this.inputMap.set('ArrowRight', 'right');
    
    // Actions
    this.inputMap.set('Space', 'action');
    this.inputMap.set('Enter', 'action');
    this.inputMap.set('Mouse0', 'action');
    
    // System
    this.inputMap.set('Escape', 'pause');
    this.inputMap.set('Tab', 'score');
  }

  // EIDOLON-V FIX: Process input for game frame
  processFrame(): {
    actions: Set<string>;
    mousePosition: { x: number; y: number };
    joystick: { x: number; y: number };
    wheelDelta: { deltaX: number; deltaY: number };
    events: InputEvent[];
  } {
    const events = this.inputManager.processFrame();
    const actions = new Set<string>();
    
    // EIDOLON-V FIX: Process all events in frame
    for (const event of events) {
      if (event.type === 'keydown' && event.key) {
        const action = this.inputMap.get(event.key);
        if (action) actions.add(action);
      }
      
      if (event.type === 'mousedown' && event.button === 0) {
        actions.add('action');
      }
    }
    
    // EIDOLON-V FIX: Check continuous inputs
    for (const key of this.inputManager.getState().keys) {
      const action = this.inputMap.get(key);
      if (action) actions.add(action);
    }
    
    if (this.inputManager.isButtonPressed(0)) {
      actions.add('action');
    }
    
    return {
      actions,
      mousePosition: this.inputManager.getMousePosition(),
      joystick: this.inputManager.getJoystick(),
      wheelDelta: this.inputManager.getWheelDelta(),
      events
    };
  }

  // EIDOLON-V FIX: Add custom input mapping
  addInputMapping(key: string, action: string): void {
    this.inputMap.set(key, action);
  }

  // EIDOLON-V FIX: Remove input mapping
  removeInputMapping(key: string): void {
    this.inputMap.delete(key);
  }

  // EIDOLON-V FIX: Get all input mappings
  getInputMappings(): Map<string, string> {
    return new Map(this.inputMap);
  }
}

// EIDOLON-V FORGE: Export singleton instances
export const inputStateManager = InputStateManager.getInstance();
export const gameInputProcessor = new GameInputProcessor();
