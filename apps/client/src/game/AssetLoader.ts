import { clientLogger } from '../core/logging/ClientLogger';

// EIDOLON-V: Minimal Asset Loader Stub
// Real asset loading handled by browser/bundler

export class AssetLoader {
  private static initialized = false;

  static async init() {
    if (this.initialized) return;

    // Minimal boot - assets are bundled by Vite
    clientLogger.info('[AssetLoader] Initialized');
    this.initialized = true;
  }

  static isReady(): boolean {
    return this.initialized;
  }
}
