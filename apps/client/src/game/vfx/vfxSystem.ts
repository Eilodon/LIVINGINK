import { GameState, Player, Vector2 } from '../../types';
import { RingId } from '../cjr/cjrTypes';
import { audioEngine } from '../audio/AudioEngine';
import { vfxBuffer, VFX_TYPES, packHex, TEXT_IDS } from '../engine/VFXRingBuffer';

export class VFXSystem {
  private screenShake: ScreenShakeController;
  // EIDOLON-V P3-2: Accessibility - global reduced motion flag
  private _reducedMotion: boolean = false;

  constructor() {
    this.screenShake = new ScreenShakeController();
  }

  // EIDOLON-V P3-2: Set reduced motion preference
  setReducedMotion(value: boolean): void {
    this._reducedMotion = value;
  }

  get reducedMotion(): boolean {
    return this._reducedMotion;
  }

  emitVFX(
    state: GameState,
    type: number,
    x: number,
    y: number,
    data: number = 0,
    id: string = ''
  ): void {
    // EIDOLON-V P3-2: Skip VFX when reduced motion is enabled
    if (this._reducedMotion) return;

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

    vfxBuffer.push(x, y, 0xffffff, type, data);
  }

  playRingCommitVFX(player: Player, ringId: RingId, state: GameState): void {
    // EIDOLON-V P3-2: Always play audio even in reduced motion mode
    if (typeof window !== 'undefined') {
      audioEngine.play(`ring_commit_${ringId}`);
    }

    // Skip visual effects if reduced motion
    if (this._reducedMotion) return;

    // 1 = Ring Commit
    this.emitVFX(state, 1, player.position.x, player.position.y, ringId, player.id);

    const intensity = ringId === 3 ? 0.7 : ringId === 2 ? 0.5 : 0.3;
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
    // EIDOLON-V P3-2: Skip shake update if reduced motion
    if (!this._reducedMotion) {
      this.screenShake.update(dt);
    }
  }

  getScreenShakeOffset(): Vector2 {
    // EIDOLON-V P3-2: Return zero offset if reduced motion
    if (this._reducedMotion) {
      return { x: 0, y: 0 };
    }
    return this.screenShake.getCurrentOffset();
  }

  getShakeIntensity(): number {
    if (this._reducedMotion) return 0;
    return this.screenShake.getCurrentIntensity();
  }
}

class ScreenShakeController {
  private intensity: number = 0;
  private duration: number = 0;
  private frequency: number = 0;
  private currentTime: number = 0;
  // EIDOLON-V P1 FIX: Reuse single object instead of creating new one each frame
  private currentOffset: Vector2 = { x: 0, y: 0 };

  applyShake(config: { intensity: number; duration: number; frequency: number }): void {
    this.intensity = config.intensity;
    this.duration = config.duration;
    this.frequency = config.frequency;
    this.currentTime = 0;
  }

  update(dt: number): void {
    if (this.currentTime >= this.duration) {
      // EIDOLON-V P1 FIX: Mutate existing object instead of creating new
      this.currentOffset.x = 0;
      this.currentOffset.y = 0;
      return;
    }
    this.currentTime += dt;
    const progress = this.currentTime / this.duration;
    const fadeOut = 1 - progress;
    // EIDOLON-V P1 FIX: Mutate existing object
    this.currentOffset.x = Math.sin(this.currentTime * this.frequency) * this.intensity * fadeOut * 20;
    this.currentOffset.y =
      Math.cos(this.currentTime * this.frequency * 1.3) * this.intensity * fadeOut * 20;
  }

  getCurrentOffset(): Vector2 {
    return this.currentOffset;
  }

  getCurrentIntensity(): number {
    if (this.currentTime >= this.duration) return 0;
    const progress = this.currentTime / this.duration;
    return this.intensity * (1 - progress);
  }
}

export const vfxSystem = new VFXSystem();
