// EIDOLON-V: Single Source of Truth for Input State
export interface InputActions {
    space: boolean;
    w: boolean;
}

export interface InputMove {
    x: number;
    y: number;
}

export interface InputEvent {
    type: 'skill' | 'boost' | 'eject';
    timestamp: number;
}

export interface InputState {
    actions: InputActions;
    move: InputMove;
    events: InputEvent[];
}

export const createDefaultInputState = (): InputState => ({
    actions: { space: false, w: false },
    move: { x: 0, y: 0 },
    events: []
});
