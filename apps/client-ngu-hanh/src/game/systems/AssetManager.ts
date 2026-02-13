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
        const cx = size / 2;
        const cy = size / 2;

        // 1. Elements
        // METAL (Diamond - Sharp, Silver)
        createTexture('element_metal', (g) => {
            g.beginFill(0xE0E0E0); // Platinum Silver
            g.lineStyle(2, 0xFFFFFF); // Sharp highlight
            // Diamond shape
            g.moveTo(cx, 4);
            g.lineTo(size - 4, cy);
            g.lineTo(cx, size - 4);
            g.lineTo(4, cy);
            g.closePath();
            g.endFill();

            // Inner faceted shine
            g.beginFill(0xFFFFFF, 0.4);
            g.moveTo(cx, 10);
            g.lineTo(size - 10, cy);
            g.lineTo(cx, cy);
            g.closePath();
            g.endFill();
        });

        // WOOD (Circle - Organic, Jade Green)
        createTexture('element_wood', (g) => {
            g.beginFill(0x2E7D32); // Jade Green
            g.lineStyle(3, 0x81C784); // Light green border
            g.drawCircle(cx, cy, size / 2 - 4);
            g.endFill();

            // Wood grain / Leaf pattern
            g.lineStyle(2, 0x1B5E20, 0.3);
            g.arc(cx, cy, size / 2 - 10, 0, Math.PI, false);
            g.moveTo(cx, 10);
            g.lineTo(cx, size - 10);
        });

        // WATER (Fluid - Deep Blue, Wave motif)
        createTexture('element_water', (g) => {
            g.beginFill(0x0277BD); // Deep Blue
            g.lineStyle(2, 0x4FC3F7); // Light hue
            // Rounded shape container
            g.drawRoundedRect(4, 4, size - 8, size - 8, 20);
            g.endFill();

            // Wave detail
            g.lineStyle(3, 0xFFFFFF, 0.5);
            g.moveTo(15, cy);
            g.quadraticCurveTo(cx, cy - 10, size - 15, cy);
            g.moveTo(15, cy + 10);
            g.quadraticCurveTo(cx, cy, size - 15, cy + 10);
        });

        // FIRE (Triangle - Orange Red, Energetic)
        createTexture('element_fire', (g) => {
            g.beginFill(0xD84315); // Deep Orange Red
            g.lineStyle(2, 0xFFAB91); // Glowy edge

            // Triangle pointing up
            g.moveTo(cx, 4);
            g.lineTo(size - 4, size - 8);
            g.lineTo(4, size - 8);
            g.closePath();
            g.endFill();

            // Inner flame core
            g.beginFill(0xFFD600, 0.6); // Yellow center
            g.drawCircle(cx, size - 20, 8);
            g.endFill();
        });

        // EARTH (Square - Amber Brown, Solid)
        createTexture('element_earth', (g) => {
            g.beginFill(0x6D4C41); // Brown
            g.lineStyle(3, 0xA1887F); // Light brown edge
            g.drawRect(6, 6, size - 12, size - 12);
            g.endFill();

            // Cracks / Texture
            g.lineStyle(2, 0x3E2723, 0.4);
            g.moveTo(15, 15);
            g.lineTo(30, 30);
            g.lineTo(20, 45);
        });

        // 2. Modifiers
        // ASH (Dark Grey Charred)
        createTexture('mod_ash', (g) => {
            g.beginFill(0x212121); // Dark Grey
            g.drawRect(4, 4, size - 8, size - 8);
            g.endFill();
            // Embers
            g.beginFill(0xFF5722, 0.8);
            g.drawCircle(20, 40, 2);
            g.drawCircle(45, 20, 3);
            g.endFill();
        });

        // STONE (Light Grey Rock)
        createTexture('mod_stone', (g) => {
            g.beginFill(0x9E9E9E); // Grey
            g.lineStyle(2, 0x616161);
            g.drawRoundedRect(4, 4, size - 8, size - 8, 4);
            g.endFill();
            // Rock texture
            g.lineStyle(2, 0x424242, 0.3);
            g.moveTo(15, 45);
            g.lineTo(45, 15);
        });

        // LOCK (Cage Overlay)
        createTexture('mod_lock', (g) => {
            g.lineStyle(4, 0xB0BEC5); // Steel bars
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
            // Inner glow
            g.lineStyle(2, 0xFFAB00, 0.5);
            g.drawRect(4, 4, size - 8, size - 8);
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
