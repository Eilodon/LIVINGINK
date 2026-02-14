/**
 * FluidQualityManager — Element Properties + Quality Control
 * 
 * Tách biệt fluid quality khỏi PerformanceManager.
 * Cung cấp element-specific properties (màu, viscosity, spread).
 */

import { PerformanceTier } from './PerformanceManager.js';

// --- ELEMENT FLUID PROPERTIES ---
// Keys = Rust u8 values: HỎA=1, KIM=2, THỦY=3, THỔ=4, MỘC=5

export interface FluidProperties {
    color: [number, number, number];   // RGB normalized
    viscosity: number;                  // Độ nhớt — cao = chảy chậm
    spread: number;                     // Độ lan — cao = lan nhanh
    emissionRate: number;               // Tỷ lệ phát particles
}

export const ELEMENT_FLUID_PROPERTIES: Record<number, FluidProperties> = {
    1: { color: [0.9, 0.2, 0.1], viscosity: 0.3, spread: 1.5, emissionRate: 2.0 },   // HỎA — lửa: loãng, lan mạnh
    2: { color: [0.8, 0.7, 0.2], viscosity: 1.0, spread: 1.0, emissionRate: 0.5 },   // KIM — kim loại: trung bình
    3: { color: [0.1, 0.3, 0.8], viscosity: 0.8, spread: 1.2, emissionRate: 1.5 },   // THỦY — nước: hơi nhớt, lan vừa
    4: { color: [0.5, 0.3, 0.1], viscosity: 1.5, spread: 0.8, emissionRate: 0.3 },   // THỔ — đất: nhớt, lan chậm
    5: { color: [0.2, 0.7, 0.2], viscosity: 0.5, spread: 1.3, emissionRate: 1.2 },   // MỘC — gỗ: nhẹ, lan nhanh
};

// --- FLUID SETTINGS PER PERFORMANCE TIER ---

export interface FluidSettings {
    simResolution: number;      // Kích thước texture simulation
    pressureIterations: number; // Số lần Jacobi iteration
    dyeResolution: number;      // Kích thước texture dye
    bloomEnabled: boolean;
    particlesEnabled: boolean;
    maxParticles: number;
}

const FLUID_SETTINGS: Record<PerformanceTier, FluidSettings> = {
    [PerformanceTier.GOD]: {
        simResolution: 256,
        pressureIterations: 40,
        dyeResolution: 512,
        bloomEnabled: true,
        particlesEnabled: true,
        maxParticles: 2000
    },
    [PerformanceTier.HIGH]: {
        simResolution: 128,
        pressureIterations: 25,
        dyeResolution: 256,
        bloomEnabled: true,
        particlesEnabled: true,
        maxParticles: 1000
    },
    [PerformanceTier.MID]: {
        simResolution: 64,
        pressureIterations: 15,
        dyeResolution: 128,
        bloomEnabled: false,
        particlesEnabled: true,
        maxParticles: 500
    },
    [PerformanceTier.LOW]: {
        simResolution: 32,
        pressureIterations: 8,
        dyeResolution: 64,
        bloomEnabled: false,
        particlesEnabled: false,
        maxParticles: 0
    }
};

// --- MANAGER ---

export class FluidQualityManager {
    private currentTier: PerformanceTier = PerformanceTier.MID;
    private currentSettings: FluidSettings = FLUID_SETTINGS[PerformanceTier.MID];

    /**
     * Cập nhật quality dựa trên tier hiện tại
     */
    adjustQuality(tier: PerformanceTier): FluidSettings {
        this.currentTier = tier;
        this.currentSettings = FLUID_SETTINGS[tier];
        return this.currentSettings;
    }

    /**
     * Lấy settings hiện tại
     */
    getSettings(): FluidSettings {
        return this.currentSettings;
    }

    /**
     * Lấy properties theo element type (Rust u8)
     */
    getElementProperties(elementType: number): FluidProperties {
        return ELEMENT_FLUID_PROPERTIES[elementType] || ELEMENT_FLUID_PROPERTIES[3]; // Default = THỦY
    }

    /**
     * Tính toán sim resolution phù hợp với screen size
     */
    getOptimalSimResolution(screenWidth: number, screenHeight: number): number {
        const maxDim = Math.max(screenWidth, screenHeight);
        const idealRes = Math.min(this.currentSettings.simResolution, Math.floor(maxDim / 4));
        // Làm tròn xuống power of 2
        return Math.pow(2, Math.floor(Math.log2(idealRes)));
    }
}
