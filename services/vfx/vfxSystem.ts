import { GameState, Player, Vector2 } from '../../types';
import { RingId } from '../cjr/cjrTypes';
import { audioEngine } from '../audio/AudioEngine';
import { vfxBuffer, VFX_TYPES, packHex, TEXT_IDS } from '../engine/VFXRingBuffer';

export class VFXSystem {
  private screenShake: ScreenShakeController;

  constructor() {
    this.screenShake = new ScreenShakeController();
  }

  emitVFX(state: GameState, type: number, x: number, y: number, data: number = 0, id: string = ''): void {
    // EIDOLON-V: Direct Push to SharedArrayBuffer
    // We map legacy "type" to VFX_TYPES if possible, or pass raw if supported.
    // Assuming type matches VFX_TYPES enum or is compatible integer.
    // If "id" implies text, we might need special handling, but basic particle/event is:
    // x, y, color (0 for default/from-data), type, data

    // Note: packHex(data) might be needed if data is color? 
    // In legacy calls:
    // type=1 (Ring Commit) -> data=RingId
    // type=2 (Dash) -> data=0
    // type=3 (Bump) -> data=0
    // type=4 (Pierce) -> data=0
    // type=5 (Vortex) -> data=0

    // We use data param as subtype-like or raw value.
    // For COLOR, we might default to White or Gold.

    // Legacy mapping:
    // 1 -> VFX_TYPES.RING_PULSE (Assumed, check VFX_TYPES)
    // 2 -> DASH_WIND
    // ...
    // Actually, let's just push raw type and data. Renderer interprets it.

    vfxBuffer.push(x, y, 0xFFFFFF, type, data);
  }

  playRingCommitVFX(player: Player, ringId: RingId, state: GameState): void {
    // 1 = Ring Commit
    this.emitVFX(state, 1, player.position.x, player.position.y, ringId, player.id);

    if (typeof window !== 'undefined') {
      audioEngine.play(`ring_commit_${ringId}`);
    }

    const intensity = ringId === 3 ? 0.7 : (ringId === 2 ? 0.5 : 0.3);
    this.screenShake.applyShake({ intensity, duration: 0.5, frequency: 20 });

    // Zero-GC VFX
    let textId: number = TEXT_IDS.NONE;
    if (ringId === 1) textId = TEXT_IDS.RING_1;
    else if (ringId === 2) textId = TEXT_IDS.RING_2;
    else if (ringId === 3) textId = TEXT_IDS.RING_3;

    if (textId !== TEXT_IDS.NONE) {
      vfxBuffer.push(
        player.position.x,
        player.position.y - 50,
        packHex('#ffd700'),
        VFX_TYPES.FLOATING_TEXT,
        textId
      );
    }
  }

  updateEffects(state: GameState, dt: number): void {
    this.screenShake.update(dt);
  }

  getScreenShakeOffset(): Vector2 {
    return this.screenShake.getCurrentOffset();
  }
}

class ScreenShakeController {
  private intensity: number = 0;
  private duration: number = 0;
  private frequency: number = 0;
  private currentTime: number = 0;
  private currentOffset: Vector2 = { x: 0, y: 0 };

  applyShake(config: { intensity: number; duration: number; frequency: number }): void {
    this.intensity = config.intensity;
    this.duration = config.duration;
    this.frequency = config.frequency;
    this.currentTime = 0;
  }

  update(dt: number): void {
    if (this.currentTime >= this.duration) {
      this.currentOffset = { x: 0, y: 0 };
      return;
    }
    this.currentTime += dt;
    const progress = this.currentTime / this.duration;
    const fadeOut = 1 - progress;
    const shakeX = Math.sin(this.currentTime * this.frequency) * this.intensity * fadeOut * 20;
    const shakeY = Math.cos(this.currentTime * this.frequency * 1.3) * this.intensity * fadeOut * 20;
    this.currentOffset = { x: shakeX, y: shakeY };
  }

  getCurrentOffset(): Vector2 {
    return this.currentOffset;
  }
}

export const vfxSystem = new VFXSystem();
