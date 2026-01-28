import { InputState, createDefaultInputState } from '../../types/input';

export type InputManager = typeof inputManager;

export const inputManager = {
    // State hiện tại (được Engine đọc mỗi tick)
    state: createDefaultInputState() as InputState,

    // --- Keyboard Handling ---
    keys: new Set<string>(),

    init() {
        if (typeof window === 'undefined') return;
        // Bind listeners
        // Helper to bind context or just use arrow functions
        window.addEventListener('keydown', (e) => this.onKey(e.code, true));
        window.addEventListener('keyup', (e) => this.onKey(e.code, false));
    },

    // --- Zero GC Optimization ---
    // Float32Array [x, y]
    sharedInputBuffer: new Float32Array(2),

    reset() {
        this.keys.clear();
        this.joystickVector = { x: 0, y: 0 };
        this.state = createDefaultInputState();
        this.sharedInputBuffer.fill(0);
    },

    onKey(code: string, isDown: boolean) {
        if (isDown) this.keys.add(code); else this.keys.delete(code);
        this.updateMoveVector();

        // Skill Trigger (Space)
        if (code === 'Space') {
            this.state.actions.space = isDown; // EIDOLON-V: use specific action
            if (isDown) this.pushEvent('skill');
        }
        // Eject Trigger (W)
        if (code === 'KeyW') {
            this.state.actions.w = isDown; // EIDOLON-V: use specific action
            if (isDown) this.pushEvent('eject');
        }
    },

    // --- Virtual Joystick Handling ---
    joystickVector: { x: 0, y: 0 },

    setJoystick(x: number, y: number) {
        this.joystickVector.x = x;
        this.joystickVector.y = y;
        this.updateMoveVector();
    },

    setButton(btn: 'skill' | 'eject', isDown: boolean) {
        // Map btn to generic action key if needed, or update actions directly
        // Currently hardcoded mapping:
        if (btn === 'skill') this.state.actions.space = isDown;
        if (btn === 'eject') this.state.actions.w = isDown;

        if (isDown) this.pushEvent(btn);
    },

    // --- Core Logic ---
    updateMoveVector() {
        let jx = 0;
        let jy = 0;

        // Ưu tiên Joystick nếu có input
        if (Math.abs(this.joystickVector.x) > 0.01 || Math.abs(this.joystickVector.y) > 0.01) {
            jx = this.joystickVector.x;
            jy = this.joystickVector.y;

            // NaN Check
            if (isNaN(jx)) jx = 0;
            if (isNaN(jy)) jy = 0;

            const len = Math.sqrt(jx * jx + jy * jy);
            if (len > 1.0) {
                jx /= len;
                jy /= len;
            }
        } else {
            // Fallback Keyboard (WASD / Arrows)
            if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) jy -= 1;
            if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) jy += 1;
            if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) jx -= 1;
            if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) jx += 1;

            // Normalize
            const len = Math.sqrt(jx * jx + jy * jy);
            if (len > 0) {
                jx /= len;
                jy /= len;
            }
        }

        // EIDOLON-V FIX: Zero allocation update
        this.state.move.x = jx;
        this.state.move.y = jy;

        // Sync to shared buffer
        this.sharedInputBuffer[0] = jx;
        this.sharedInputBuffer[1] = jy;
    },

    pushEvent(type: 'skill' | 'eject' | 'boost') {
        // EIDOLON-V: Use timestamp
        this.state.events.push({ type, timestamp: Date.now() });
    },

    // Engine gọi hàm này để lấy và xóa queue
    popEvents() {
        const evts = [...this.state.events];
        this.state.events = [];
        return evts;
    },

    // Engine gọi hàm này để tính target position mà KHÔNG tạo object mới
    updateTargetPosition(currentPos: { x: number, y: number }, outTarget: { x: number, y: number }) {
        // Target = Current + Vector * Offset
        const OFFSET = 250;
        // Use shared buffer for maximum speed/thread safety simulation
        const mx = this.sharedInputBuffer[0];
        const my = this.sharedInputBuffer[1];

        outTarget.x = currentPos.x + mx * OFFSET;
        outTarget.y = currentPos.y + my * OFFSET;
    },

    // Legacy support (DEPRECATED: Allocates)
    getMoveTarget(currentPos: { x: number, y: number }) {
        const t = { x: 0, y: 0 };
        this.updateTargetPosition(currentPos, t);
        return t;
    }
};
