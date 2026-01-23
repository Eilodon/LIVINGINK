
import { Application } from 'pixi.js';
import { GameState, Vector2 } from '../../types';

export interface ParticleConfig {
  color: string;
  speed: number;
}

export type ScreenEffect = 'shake' | 'flash' | 'none';

class VFXManager {
  private app: Application | null = null;

  init(app: Application) {
    this.app = app;
  }

  createEffect(type: string, pos: Vector2) {
    // Placeholder
  }
}

export const vfxManager = new VFXManager();
