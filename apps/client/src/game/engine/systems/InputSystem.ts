import { BufferedInput } from '../../input/BufferedInput';
import { NetworkClient } from '../../../network/NetworkClient';
import { GameState } from '../../../types';
import { InputStore, TransformStore } from '@cjr/engine';

export class InputSystem {
    private bufferedInput: BufferedInput;
    private tempMoveTarget = { x: 0, y: 0 };

    constructor() {
        this.bufferedInput = BufferedInput.getInstance();
    }

    public reset(): void {
        this.bufferedInput.reset();
    }

    public update(state: GameState, networkClient: NetworkClient, isMultiplayer: boolean, dt: number): void {
        if (isMultiplayer) {
            // Multiplayer Logic
            const events = this.bufferedInput.popEvents();
            this.bufferedInput.updateTargetPosition(state.player.position, this.tempMoveTarget);

            const actions = this.bufferedInput.state.actions;
            const networkInputs = {
                space: actions.space,
                w: actions.w,
            };

            networkClient.sendInput(this.tempMoveTarget, networkInputs, dt, events);
        } else {
            // Singleplayer Logic
            // Get player position from DOD Store
            const pIdx = state.player.physicsIndex ?? 0;
            const tIdx = pIdx * 8;
            const playerWorldX = TransformStore.data[tIdx];
            const playerWorldY = TransformStore.data[tIdx + 1];

            // Sync Input directly to DOD Store
            this.bufferedInput.syncToStore(
                0,
                { x: playerWorldX, y: playerWorldY },
                { x: state.camera.x, y: state.camera.y }
            );

            // Verify Target consistency (Optional, for legacy support)
            const inputTarget = { x: 0, y: 0 };
            InputStore.getTarget(0, inputTarget);
            state.player.targetPosition.x = inputTarget.x;
            state.player.targetPosition.y = inputTarget.y;
        }
    }
}

export const inputSystem = new InputSystem();
