/**
 * @eidolon/engine - ClientRunner
 *
 * Client-side game simulation extending BaseSimulation.
 * Adds prediction, interpolation, render sync, and visual effects.
 *
 * ## Responsibilities
 * - Input prediction and reconciliation
 * - Entity interpolation for smooth rendering
 * - Camera control and viewport culling
 * - VFX event handling
 * - Render state synchronization
 *
 * ## Architecture
 * ClientRunner runs the same core simulation as the server but with:
 * 1. Prediction for local player inputs (immediate feedback)
 * 2. Interpolation for remote entities (smooth movement)
 * 3. Render sync (DOD → Render objects)
 * 4. Visual effects (particles, screen shake)
 * 
 * EIDOLON-V: Uses generated WorldState for zero-allocation render loop
 */

import { BaseSimulation, type ISimulationConfig } from '../core/BaseSimulation.js';
import { STRIDES } from '../generated/WorldState.js';
import { TransformAccess, EntityFlags, StateAccess } from '../generated/ComponentAccessors.js';

/**
 * Entity lookup for render sync
 * Maps DOD index to renderable entity object
 */
export interface IEntityLookup {
    [index: number]: {
        id: string;
        position: { x: number; y: number };
        velocity: { x: number; y: number };
        isDead: boolean;
        physicsIndex?: number;
    } | null;
}

/**
 * Camera state
 */
export interface ICameraState {
    x: number;
    y: number;
    zoom: number;
}

/**
 * Client simulation configuration
 */
export interface IClientSimulationConfig extends ISimulationConfig {
    /** Enable input prediction */
    enablePrediction?: boolean;
    /** Enable entity interpolation */
    enableInterpolation?: boolean;
    /** Viewport size for culling */
    viewportWidth?: number;
    /** Viewport height for culling */
    viewportHeight?: number;
    /** Extra margin around viewport */
    viewportMargin?: number;
}

/**
 * ClientRunner - Client-side simulation with prediction and interpolation
 */
export abstract class ClientRunner extends BaseSimulation {
    protected clientConfig: IClientSimulationConfig;

    // Entity lookup for render sync
    protected entityLookup: IEntityLookup = {};

    // EIDOLON-V FIX: Zero-allocation entity ID tracking
    // Pre-allocated array to avoid GC pressure in render loop
    protected activeEntityIds: number[] = [];

    // Camera state
    protected camera: ICameraState = { x: 0, y: 0, zoom: 1 };

    // Viewport bounds for culling
    protected viewportMinX = 0;
    protected viewportMaxX = 0;
    protected viewportMinY = 0;
    protected viewportMaxY = 0;

    // Interpolation state
    protected previousPositions = new Map<number, { x: number; y: number }>();

    constructor(config: IClientSimulationConfig) {
        super(config);
        this.clientConfig = {
            enablePrediction: true,
            enableInterpolation: true,
            viewportWidth: 1920,
            viewportHeight: 1080,
            viewportMargin: 200,
            ...config,
        };
    }

    /**
     * Called during initialization
     */
    protected onInitialize(): void {
        this.setupClientSystems();
    }

    /**
     * Called during shutdown
     */
    protected onShutdown(): void {
        this.cleanupClientSystems();
    }

    /**
     * Called for render interpolation
     * @param alpha Interpolation factor (0-1 between physics frames)
     */
    protected onInterpolate(alpha: number): void {
        if (this.clientConfig.enableInterpolation) {
            this.interpolateEntities(alpha);
        }
        this.syncToRenderState();
    }

    /**
     * Called when entity dies
     */
    protected onEntityDeath(entityId: number): void {
        // Clear entity from lookup
        if (this.entityLookup[entityId]) {
            this.entityLookup[entityId] = null;
        }

        // Remove from active list using swap-pop (O(1))
        this.removeFromActiveList(entityId);

        // Emit death event for VFX
        this.onEntityDeathVisual(entityId);
    }

    // =============================================================================
    // Client-specific methods (override in concrete implementation)
    // =============================================================================

    /**
     * Setup client-specific systems (VFX, audio, etc.)
     */
    protected abstract setupClientSystems(): void;

    /**
     * Cleanup client-specific systems
     */
    protected abstract cleanupClientSystems(): void;

    /**
     * Handle entity death visuals
     */
    protected abstract onEntityDeathVisual(_entityId: number): void;

    /**
     * Handle predicted input
     */
    protected abstract handlePredictedInput(): void;

    /**
     * Reconcile prediction with server state
     */
    protected abstract reconcilePrediction(): void;

    /**
     * Sync DOD state to render objects
     */
    protected abstract syncToRenderState(): void;

    // =============================================================================
    // Utility methods
    // =============================================================================

    /**
     * Update viewport bounds based on camera position
     */
    protected updateViewportBounds(): void {
        const halfW = (this.clientConfig.viewportWidth || 1920) / 2;
        const halfH = (this.clientConfig.viewportHeight || 1080) / 2;
        const margin = this.clientConfig.viewportMargin || 200;

        this.viewportMinX = this.camera.x - halfW - margin;
        this.viewportMaxX = this.camera.x + halfW + margin;
        this.viewportMinY = this.camera.y - halfH - margin;
        this.viewportMaxY = this.camera.y + halfH + margin;
    }

    /**
     * Check if position is in viewport
     */
    protected isInViewport(x: number, y: number): boolean {
        return (
            x >= this.viewportMinX &&
            x <= this.viewportMaxX &&
            y >= this.viewportMinY &&
            y <= this.viewportMaxY
        );
    }

    /**
     * EIDOLON-V FIX: Zero-allocation interpolation loop
     * Uses pre-cached activeEntityIds instead of Object.keys()
     */
    protected interpolateEntities(alpha: number): void {
        const len = this.activeEntityIds.length;

        for (let i = 0; i < len; i++) {
            const entityId = this.activeEntityIds[i];
            const entity = this.entityLookup[entityId];

            if (!entity || entity.isDead) continue;

            // Skip if not active in DOD
            if (!StateAccess.isActive(this.world, entityId)) continue;

            // Get current DOD position
            const currentX = TransformAccess.getX(this.world, entityId);
            const currentY = TransformAccess.getY(this.world, entityId);

            // Get previous position
            const prev = this.previousPositions.get(entityId);
            if (prev) {
                // Interpolate between previous and current
                entity.position.x = prev.x + (currentX - prev.x) * alpha;
                entity.position.y = prev.y + (currentY - prev.y) * alpha;
            }

            // Store current for next frame
            this.previousPositions.set(entityId, { x: currentX, y: currentY });
        }
    }

    /**
     * Get camera state
     */
    getCamera(): ICameraState {
        return { ...this.camera };
    }

    /**
     * Set camera position
     */
    setCamera(x: number, y: number): void {
        this.camera.x = x;
        this.camera.y = y;
    }

    /**
     * Register entity for render sync
     * EIDOLON-V FIX: Also adds to activeEntityIds for zero-allocation loop
     */
    registerEntity(entityId: number, entity: IEntityLookup[number]): void {
        this.entityLookup[entityId] = entity;

        // Add to active list if not already present
        if (!this.activeEntityIds.includes(entityId)) {
            this.activeEntityIds.push(entityId);
        }
    }

    /**
     * Unregister entity
     * EIDOLON-V FIX: Uses swap-pop for O(1) removal
     */
    unregisterEntity(entityId: number): void {
        delete this.entityLookup[entityId];
        this.previousPositions.delete(entityId);
        this.removeFromActiveList(entityId);
    }

    /**
     * Remove entity from active list using swap-pop (O(1) instead of splice O(n))
     */
    private removeFromActiveList(entityId: number): void {
        const idx = this.activeEntityIds.indexOf(entityId);
        if (idx !== -1) {
            // Swap with last element and pop
            const lastIdx = this.activeEntityIds.length - 1;
            if (idx !== lastIdx) {
                this.activeEntityIds[idx] = this.activeEntityIds[lastIdx];
            }
            this.activeEntityIds.pop();
        }
    }

    /**
     * Get client config
     */
    getClientConfig(): IClientSimulationConfig {
        return { ...this.clientConfig };
    }

    /**
     * Get entity in viewport count for debugging
     * EIDOLON-V FIX: Uses activeEntityIds instead of Object.keys()
     */
    getViewportEntityCount(): number {
        let count = 0;
        const len = this.activeEntityIds.length;

        for (let i = 0; i < len; i++) {
            const entityId = this.activeEntityIds[i];
            if (!StateAccess.isActive(this.world, entityId)) continue;

            const x = TransformAccess.getX(this.world, entityId);
            const y = TransformAccess.getY(this.world, entityId);

            if (this.isInViewport(x, y)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Get total active entity count
     */
    getActiveEntityCount(): number {
        return this.activeEntityIds.length;
    }
}
