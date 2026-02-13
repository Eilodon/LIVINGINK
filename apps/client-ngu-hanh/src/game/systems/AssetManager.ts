import { Texture, Application, Graphics, Renderer } from 'pixi.js';

export class AssetManager {
    private textures: Map<string, Texture>;
    private app: Application;

    constructor(app: Application) {
        this.app = app;
        this.textures = new Map();
    }

    async loadAssets(): Promise<void> {
        console.log('[AssetManager] Loading assets...');
        // In the future, this will load from a sprite sheet or URLs.
        // For Phase 1 MVP, we generate procedural textures.
        this.generateProceduralTextures();
        console.log('[AssetManager] Assets loaded.');
    }

    private generateProceduralTextures(): void {
        const renderer = this.app.renderer as Renderer;

        // Helper to generate and cache texture
        const createTexture = (key: string, draw: (g: Graphics) => void) => {
            const g = new Graphics();
            draw(g);
            const texture = this.app.renderer.generateTexture(g);
            this.textures.set(key, texture);
        };

        const size = 64; // Base size for tiles

        // 1. Elements
        // METAL (Silver Circle)
        createTexture('element_metal', (g) => {
            g.beginFill(0xC0C0C0); // Silver
            g.lineStyle(2, 0xFFFFFF);
            g.drawCircle(size / 2, size / 2, size / 2 - 4);
            g.endFill();
            // Shine
            g.beginFill(0xFFFFFF, 0.5);
            g.drawCircle(size / 2 - 10, size / 2 - 10, 8);
            g.endFill();
        });

        // WOOD (Green Rounded Rect / Leafy)
        createTexture('element_wood', (g) => {
            g.beginFill(0x228B22); // Forest Green
            g.lineStyle(2, 0x90EE90);
            g.drawRoundedRect(4, 4, size - 8, size - 8, 16);
            g.endFill();
            // Leaf vein detail (simple line)
            g.lineStyle(2, 0x006400, 0.5);
            g.moveTo(size / 2, 10);
            g.lineTo(size / 2, size - 10);
        });

        // WATER (Blue Fluid Step)
        createTexture('element_water', (g) => {
            g.beginFill(0x1E90FF); // Dodger Blue
            g.lineStyle(2, 0x87CEFA);
            g.drawCircle(size / 2, size / 2, size / 2 - 4);
            g.endFill();
            // Bubble detail
            g.beginFill(0xFFFFFF, 0.3);
            g.drawCircle(size / 2 + 10, size / 2 - 10, 6);
            g.endFill();
        });

        // FIRE (Red Triangle)
        createTexture('element_fire', (g) => {
            g.beginFill(0xFF4500); // Orange Red
            g.lineStyle(2, 0xFFD700); // Gold outline
            g.moveTo(size / 2, 4);
            g.lineTo(size - 4, size - 4);
            g.lineTo(4, size - 4);
            g.closePath();
            g.endFill();
            // Inner flame
            g.beginFill(0xFFFF00, 0.5);
            g.drawCircle(size / 2, size - 20, 10);
            g.endFill();
        });

        // EARTH (Brown Square)
        createTexture('element_earth', (g) => {
            g.beginFill(0x8B4513); // Saddle Brown
            g.lineStyle(2, 0xD2691E);
            g.drawRect(8, 8, size - 16, size - 16);
            g.endFill();
            // Cracks
            g.lineStyle(2, 0x3E2723, 0.6);
            g.moveTo(10, 10);
            g.lineTo(25, 25);
            g.lineTo(15, 35);
        });

        // 2. Modifiers
        // ASH (Dark Grey Charred)
        createTexture('mod_ash', (g) => {
            g.beginFill(0x2F4F4F); // Dark Slate Grey
            g.drawRect(4, 4, size - 8, size - 8);
            g.endFill();
            // Embers
            g.beginFill(0xFF4500, 0.8);
            g.drawCircle(20, 20, 2);
            g.drawCircle(40, 50, 3);
            g.drawCircle(50, 20, 2);
            g.endFill();
        });

        // STONE (Light Grey Rock)
        createTexture('mod_stone', (g) => {
            g.beginFill(0x808080); // Grey
            g.lineStyle(2, 0x505050);
            g.drawRoundedRect(4, 4, size - 8, size - 8, 4);
            g.endFill();
            // Rock texture
            g.lineStyle(1, 0x333333, 0.3);
            g.moveTo(10, 40);
            g.lineTo(30, 20);
        });

        // LOCK (Cage Overlay)
        createTexture('mod_lock', (g) => {
            g.lineStyle(4, 0xFFFFFF); // White bars
            g.drawRect(4, 4, size - 8, size - 8);
            g.moveTo(20, 4);
            g.lineTo(20, size - 4);
            g.moveTo(44, 4);
            g.lineTo(44, size - 4);
        });

        // SELECTED (Selection Border)
        createTexture('status_selected', (g) => {
            g.lineStyle(4, 0xFFD700); // Gold
            g.drawRect(0, 0, size, size); // Full size border
        });
    }

    getTexture(key: string): Texture {
        const t = this.textures.get(key);
        if (!t) {
            console.warn(`[AssetManager] Texture not found: ${key}`);
            return Texture.WHITE; // Fallback
        }
        return t;
    }
}
