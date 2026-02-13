import { IGameContext, EntityManager, WorldState } from '@cjr/engine';
import { Application, Container, Graphics } from 'pixi.js';

export class GameHost implements IGameContext {
    entityManager: EntityManager;
    private app: Application;
    private worldContainer: Container;
    private entityVisuals: Map<number, Container | Graphics>;

    constructor(entityManager: EntityManager, app: Application, worldContainer: Container) {
        this.entityManager = entityManager;
        this.app = app;
        this.worldContainer = worldContainer;
        this.entityVisuals = new Map();
    }

    spawnVisual(entityId: number, color: number, shape: number): void {
        // Procedural Graphics for MVP
        const graphics = new Graphics();

        // Shape: 0-4 matching ElementType
        // METAL=0 (Circle, Gray)
        // WOOD=1 (Rect, Green)
        // WATER=2 (Round Rect, Blue)
        // FIRE=3 (Triangle, Red)
        // EARTH=4 (Diamond, Brown)

        const size = 50;

        graphics.beginFill(color);

        switch (shape) {
            case 0: // METAL - Circle
                graphics.drawCircle(0, 0, size / 2);
                break;
            case 1: // WOOD - Rectangle (Vertical)
                graphics.drawRect(-size / 2 + 5, -size / 2, size - 10, size);
                break;
            case 2: // WATER - Rounded Rect
                graphics.drawRoundedRect(-size / 2, -size / 2, size, size, 15);
                break;
            case 3: // FIRE - Triangle
                graphics.moveTo(0, -size / 2);
                graphics.lineTo(size / 2, size / 2);
                graphics.lineTo(-size / 2, size / 2);
                graphics.closePath();
                break;
            case 4: // EARTH - Diamond (Rotated Square)
                graphics.drawRect(-size / 2, -size / 2, size, size);
                graphics.rotation = Math.PI / 4;
                // Scale down slightly to fit due to rotation
                graphics.scale.set(0.8);
                break;
            default:
                graphics.drawCircle(0, 0, size / 4);
                break;
        }

        graphics.endFill();

        // White border
        graphics.lineStyle(2, 0xffffff, 0.5);
        if (shape === 0) graphics.drawCircle(0, 0, size / 2); // Re-stroke circle
        // Other shapes rely on fill path usually, simplistic stroke for MVP

        this.worldContainer.addChild(graphics);
        this.entityVisuals.set(entityId, graphics);
    }

    setVisualState(entityId: number, state: number): void {
        const visual = this.entityVisuals.get(entityId);
        if (!visual) return;

        // State: 0=IDLE, 1=SELECTED, 2=MATCHED
        switch (state) {
            case 0: // IDLE
                visual.alpha = 1.0;
                visual.scale.set(1.0);
                if (visual.rotation !== 0 && visual.rotation !== Math.PI / 4) visual.rotation = 0; // Don't reset diamond rotation
                if (visual.rotation === Math.PI / 4) visual.scale.set(0.8); // Restore diamond scale
                break;
            case 1: // SELECTED
                visual.alpha = 1.0;
                // Pulse effect handled in update? For now just static scale
                visual.scale.set(1.2);
                break;
            case 2: // MATCHED (Fade out?)
                visual.alpha = 0.5;
                visual.scale.set(0.5);
                break;
        }
    }

    getVisual(entityId: number): Container | Graphics | undefined {
        return this.entityVisuals.get(entityId);
    }

    updateVisuals(world: WorldState): void {
        // Sync visual position with internal state if needed
        // For now, GridSystem handles position via TransformAccess?
        // If TransformAccess updates, we need to read it here and update Pixi positions.

        // TODO: Implement Sync System here or in GameCanvas loop
    }

    cleanup(): void {
        this.entityVisuals.forEach(v => v.destroy());
        this.entityVisuals.clear();
    }
}
