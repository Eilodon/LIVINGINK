import { GameState, Player } from '../../types';
import { RingId, TattooId } from '../cjr/cjrTypes';
import { vfxSystem } from './vfxSystem';
import { tattooVFXSystem } from './tattooVFX';

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
    // Chỉ update logic shake, còn particle do Pixi lo
    vfxSystem.updateEffects(state, dt);
  }

  getScreenShakeOffset() {
    return vfxSystem.getScreenShakeOffset();
  }
}

export const vfxIntegrationManager = new VFXIntegrationManager();
