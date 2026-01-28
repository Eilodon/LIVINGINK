import { GameState, Player, Vector2 } from '../../types';
import { RingId } from '../cjr/cjrTypes';
import { audioEngine } from '../audio/AudioEngine';

export class VFXSystem {
  private screenShake: ScreenShakeController;

  constructor() {
    this.screenShake = new ScreenShakeController();
  }

  emitVFX(state: GameState, type: number, x: number, y: number, data: number = 0, id: string = ''): void {
    const MAX_EVENTS = 50;
    // Check if vfxEvents is initialized (some tests or legacy states might validly fail this if not migrated)
    if (!state.vfxEvents || !Array.isArray(state.vfxEvents)) return;

    // Safety for legacy "push" array that hasn't been re-inited as object pool
    if (state.vfxEvents.length !== MAX_EVENTS) {
      // Optionally migrating on the fly, but safer to assume it's set up
      // If it is string[], this will crash or type error at runtime, but we changed types.
      // Runtime check:
      if (state.vfxEvents.length === 0 || typeof state.vfxEvents[0] !== 'object') {
        // Reset
        state.vfxEvents = Array.from({ length: MAX_EVENTS }, () => ({ type: 0, x: 0, y: 0, data: 0, id: '', seq: 0 }));
        state.vfxHead = 0;
      }
    }

    const idx = (state.vfxHead || 0) % MAX_EVENTS;
    const evt = state.vfxEvents[idx];
    if (evt) {
      evt.type = type;
      evt.x = x;
      evt.y = y;
      evt.data = data;
      evt.id = id;
      evt.seq = Date.now();
    }
    state.vfxHead = ((state.vfxHead || 0) + 1) % MAX_EVENTS;
  }

  playRingCommitVFX(player: Player, ringId: RingId, state: GameState): void {
    // 1 = Ring Commit
    this.emitVFX(state, 1, player.position.x, player.position.y, ringId, player.id);

    if (typeof window !== 'undefined') {
      audioEngine.play(`ring_commit_${ringId}`);
    }

    const intensity = ringId === 3 ? 0.7 : (ringId === 2 ? 0.5 : 0.3);
    this.screenShake.applyShake({ intensity, duration: 0.5, frequency: 20 });

    state.floatingTexts.push({
      id: Math.random().toString(),
      position: { ...player.position, y: player.position.y - 50 },
      text: `RING ${ringId}!`,
      color: '#ffd700',
      size: 24,
      life: 2.0,
      velocity: { x: 0, y: -50 }
    });
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
