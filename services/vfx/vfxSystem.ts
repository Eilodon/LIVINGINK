import { GameState, Player, Vector2 } from '../../types';
import { RingId } from '../cjr/cjrTypes';
// import { audioEngine } from '../audio/AudioEngine'; // Tạm thời comment vì chưa rõ cấu trúc AudioEngine

export class VFXSystem {
  private screenShake: ScreenShakeController;

  constructor() {
    this.screenShake = new ScreenShakeController();
  }

  // --- EVENTS (Server/Client Safe) ---

  playRingCommitVFX(player: Player, ringId: RingId, state: GameState): void {
    // 1. Push Event String: "commit:x:y:playerId:ringId"
    // Client (PixiGameCanvas) sẽ parse chuỗi này và gọi CrystalVFX.shockwave/spiral
    state.vfxEvents.push(`commit:${player.position.x}:${player.position.y}:${player.id}:${ringId}`);

    // 2. Audio (Placeholder)
    // if (typeof window !== 'undefined') {
    //      audioEngine.play(`ring_commit_${ringId}`);
    // }

    // 3. Screen Shake (Logic)
    const intensity = ringId === 3 ? 0.7 : (ringId === 2 ? 0.5 : 0.3);
    this.screenShake.applyShake({ intensity, duration: 0.5, frequency: 20 });

    // 4. Floating Text (Giữ trong state vì nó là UI info)
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
    const shakeX = Math.sin(this.currentTime * this.frequency) * this.intensity * fadeOut * 20; // Scale 20px
    const shakeY = Math.cos(this.currentTime * this.frequency * 1.3) * this.intensity * fadeOut * 20;
    this.currentOffset = { x: shakeX, y: shakeY };
  }

  getCurrentOffset(): Vector2 {
    return this.currentOffset;
  }
}

export const vfxSystem = new VFXSystem();
