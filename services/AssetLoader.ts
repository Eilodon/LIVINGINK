// EIDOLON-V: Minimal Asset Loader Stub
// Real asset loading handled by browser/bundler

export class AssetLoader {
  private static initialized = false;

  static async init(): Promise<void> {
    if (this.initialized) return;

    // Minimal boot - assets are bundled by Vite
    console.log('[AssetLoader] Initialized');
    this.initialized = true;
  }

  static isReady(): boolean {
    return this.initialized;
  }
}
