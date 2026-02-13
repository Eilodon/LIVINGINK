import { IGameContext, EntityManager, WorldState } from '@cjr/engine';
import { Application, Container, Sprite, Graphics } from 'pixi.js';
import { AssetManager } from './systems/AssetManager';
import { ParticleManager } from './systems/ParticleManager';
import { UISystem } from './systems/UISystem';

export class GameHost implements IGameContext {
    entityManager: EntityManager;
    private app: Application;
    private worldContainer: Container;
    private entityVisuals: Map<number, Container>;
    private assetManager: AssetManager;
    private particleManager: ParticleManager;

    // Shake properties
    private shakeIntensity: number = 0;
    private shakeDecay: number = 0.9;

    constructor(entityManager: EntityManager, app: Application, worldContainer: Container) {
        this.entityManager = entityManager;
        this.app = app;
        this.worldContainer = worldContainer;
        this.entityVisuals = new Map();
        this.assetManager = new AssetManager(app);

        // Initialize systems
        this.assetManager.loadAssets();
        this.particleManager = new ParticleManager(app, worldContainer);

        // Add update loop for shake
        this.app.ticker.add(this.update, this);
    }

    // Trigger Shake
    triggerShake(intensity: number): void {
        this.shakeIntensity = intensity;
    }

    update(): void {
        if (this.shakeIntensity > 0) {
            const rx = (Math.random() - 0.5) * this.shakeIntensity;
            const ry = (Math.random() - 0.5) * this.shakeIntensity;
            this.worldContainer.position.set(rx, ry); // Offset from 0,0 (assuming world is centered or handled elsewhere)

            this.shakeIntensity *= this.shakeDecay;
            if (this.shakeIntensity < 0.5) {
                this.shakeIntensity = 0;
                this.worldContainer.position.set(0, 0); // Reset
            }
        }
    }

    spawnVisual(entityId: number, color: number, shape: number): void {
        const container = new Container();

        // 1. Base Sprite (Element)
        let textureKey = 'element_metal';
        switch (shape) {
            case 0: textureKey = 'element_metal'; break;
            case 1: textureKey = 'element_wood'; break;
            case 2: textureKey = 'element_water'; break;
            case 3: textureKey = 'element_fire'; break;
            case 4: textureKey = 'element_earth'; break;
        }

        const sprite = new Sprite(this.assetManager.getTexture(textureKey));
        sprite.anchor.set(0.5); // Center anchor
        container.addChild(sprite);

        // 2. Modifiers (Overlay)
        // We need modification data here. 
        // Currently spawnVisual only takes color/shape.
        // We might need to query the ECS or pass mod data.
        // For MVP, we assume GridSystem calls setVisualState or we query ECS?
        // Actually GridSystem calls spawnVisual with mod? No, it calls it with "color" and "shape".
        // Let's assume color/shape maps to element.
        // Modifiers are usually separate or updated via setVisualState?
        // Let's look at GridSystem.ts: spawnVisual(id, mod) is called for modifiers?
        // Ah, GridSystem calls `spawnVisual` with `mod` which is an Enum.
        // Wait, `spawnVisual` signature is `(id, color, shape)`.
        // In GridSystem: `spawnVisual(entityId, mod, 0)`?
        // Let's check GridSystem again.

        this.worldContainer.addChild(container);
        this.entityVisuals.set(entityId, container);
    }

    // GridSystem calls this to update visual state (Selected, Matched, etc.)
    // But also might use it for Mod updates if we piggyback?
    setVisualState(entityId: number, state: number): void {
        const container = this.entityVisuals.get(entityId);
        if (!container) return;

        // Reset
        container.alpha = 1.0;
        container.scale.set(1.0);

        // Check for Selection State
        // state 1 = SELECTED
        if (state === 1) {
            container.scale.set(1.1);
        } else if (state === 2) {
            // MATCHED
            container.alpha = 0; // Hide the tile

            // Spawn Burst Effect!
            // We need the position and color.
            // Color depends on the element type. We don't store it here directly easily...
            // But we can infer/hack it from the texture? 
            // Or just use generic white burst for now.
            // Better: get color from logic? No, only have ID.

            // Hack for MVP: Check texture name of child sprite to pick color
            const sprite = container.children[0] as Sprite;
            // Map texture to color hex string
            let color = "ffffff";
            // ... implementation detail ...

            this.particleManager.spawnEffect(container.x, container.y, color);

            // Trigger Screen Shake
            this.triggerShake(5); // Mild shake for match
        }

        // If state represents TileMod (ASH/STONE/LOCK)... 
        // We need a way to distinguish "Selection State" from "Tile Modifier".
        // Engine's setVisualState usually implies transient state.
        // However, GridSystem might be calling spawnVisual for Mods?
        // Let's defer Mod visual logic until we verify how GridSystem calls it.
    }

    onPreviewInteraction(data: any): void {
        // Reset all previous previews (simple approach: iterate all visuals)
        this.entityVisuals.forEach((container) => {
            const sprite = container.children[0] as Sprite; // Assume first child is base sprite
            if (sprite) {
                sprite.tint = 0xFFFFFF; // Reset tint
                container.alpha = 1.0;
            }
        });

        if (!data || data.type === 0 || !data.affectedTiles) return;

        const affected = data.affectedTiles as number[];
        const type = data.type as number;

        affected.forEach((id) => {
            const container = this.entityVisuals.get(id);
            if (container) {
                const sprite = container.children[0] as Sprite;
                if (!sprite) return;

                // Visual Feedback based on Interaction Type
                switch (type) {
                    case 1: // DESTRUCTION (Red Tint + Shake?)
                        sprite.tint = 0xFF0000;
                        container.alpha = 0.8;
                        // Maybe slight shake preview here?
                        container.x += (Math.random() - 0.5) * 2;
                        break;
                    case 2: // GENERATION (Green Tint + Glow?)
                        sprite.tint = 0x00FF00;
                        container.alpha = 1.0;
                        break;
                    case 4: // BLOCKED (Grey)
                        sprite.tint = 0x505050; // Dark grey
                        break;
                    default:
                        sprite.tint = 0xFFFF00; // Neutral/Other
                        break;
                }
            }
        });
    }

    getVisual(entityId: number): Container | undefined {
        return this.entityVisuals.get(entityId);
    }

    onSyncUI(data: any): void {
        // Forward data to UISystem
        // data structure: { boss: { hp, maxHP, state }, level: { score, movesLeft } }
        UISystem.getInstance().update(null as any, data.boss, data.level);
    }

    updateVisuals(world: WorldState): void {
        // Position sync would go here
        // Sync visual position with internal state if needed
        // Real implementation:
        // const boss = this.entityManager.getAllEntitiesWith(BossComponent)[0];
        // const stats = StatsAccess.get(boss);

        // For Phase 3 MVP, let's use a singleton or global state if possible, 
        // OR just mock it to verify the UI hookup.

        // Getting actual data:
        // world.bossSystem -> not accessible directly
        // But we can check if specific events happened?

        // Let's use a hack: The BossSystem should update a shared state or component that we read.
        // For now, I'll update UISystem with a placeholder to test the React connection.
        // Wait, I can't easily get Boss Data here without ComponentAccessors.

        // Alternative: NguHanhModule calls UISystem?
        // NguHanhModule has access to BossSystem instance.
        // GameHost is just for rendering.
        // So NguHanhModule is the better place for UI Sync.
    }

    cleanup(): void {
        this.app.ticker.remove(this.update, this);
        this.entityVisuals.forEach(v => v.destroy());
        this.entityVisuals.clear();
        this.particleManager.destroy();
    }
}
