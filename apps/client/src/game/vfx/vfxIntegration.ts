import { GameState, Player } from '@/types';
import { RingId, TattooId } from '../cjr/cjrTypes';
import { vfxSystem } from './vfxSystem';
import { tattooVFXSystem } from './tattooVFX';
import { copyVFXToArray, vfxBuffer } from '../engine/VFXRingBuffer';

export class VFXIntegrationManager {
  private lastRingCommit: Map<string, number> = new Map();
  private lastTattooActivation: Map<string, Map<TattooId, number>> = new Map();
  private vfxEnabled: boolean = true;

  setVFXEnabled(enabled: boolean): void {
    this.vfxEnabled = enabled;
  }

  handleRingCommit(player: Player, ringId: RingId, state: GameState): void {
    if (!this.vfxEnabled) return;
    const now = Date.now();
    const last = this.lastRingCommit.get(player.id) || 0;
    if (now - last < 1000) return; // Debounce 1s

    vfxSystem.playRingCommitVFX(player, ringId, state);
    this.lastRingCommit.set(player.id, now);
  }

  handleTattooActivation(player: Player, tattooId: TattooId, state: GameState): void {
    if (!this.vfxEnabled) return;
    // Logic debounce có thể thêm nếu cần
    tattooVFXSystem.playTattooActivationVFX(player, tattooId, state);
  }

  update(state: GameState, dt: number): void {
    if (!this.vfxEnabled) return;

    // EIDOLON-V Phase 4.1: Consume VFX ring buffer into state pool (zero allocation)
    const vfxCount = copyVFXToArray(state.vfxEvents, vfxBuffer);
    // Store count for UI rendering (optional - can add vfxEventCount to GameState)
    (state as any).vfxEventCount = vfxCount;

    // Update VFX effects (shake, particles via Pixi)
    vfxSystem.updateEffects(state, dt);

    // EIDOLON-V: Sync Physics/Logic Shake to Visual State for Renderer
    state.shakeIntensity = vfxSystem.getShakeIntensity();
  }

  getScreenShakeOffset() {
    return vfxSystem.getScreenShakeOffset();
  }
}

export const vfxIntegrationManager = new VFXIntegrationManager();
