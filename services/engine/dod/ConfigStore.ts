import { MAX_ENTITIES } from './EntityFlags';

export class ConfigStore {
    // [magneticRadius, damageMult, speedMult, pickupRange, visionRange, _pad, _pad, _pad]
    // Stride = 8
    public static readonly STRIDE = 8;
    public static readonly data = new Float32Array(MAX_ENTITIES * ConfigStore.STRIDE);

    static set(id: number, magneticRadius: number, damageMult: number, speedMult: number, pickupRange: number, visionRange: number) {
        const idx = id * ConfigStore.STRIDE;
        this.data[idx] = magneticRadius;
        this.data[idx + 1] = damageMult;
        this.data[idx + 2] = speedMult;
        this.data[idx + 3] = pickupRange;
        this.data[idx + 4] = visionRange;
    }

    // Accessors
    static getMagneticRadius(id: number): number {
        return this.data[id * ConfigStore.STRIDE];
    }

    static getDamageMultiplier(id: number): number {
        return this.data[id * ConfigStore.STRIDE + 1];
    }

    static getSpeedMultiplier(id: number): number {
        return this.data[id * ConfigStore.STRIDE + 2];
    }

    // Setters
    static setMagneticRadius(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE] = value;
    }

    static setDamageMultiplier(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE + 1] = value;
    }

    static setSpeedMultiplier(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE + 2] = value;
    }

    static setPickupRange(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE + 3] = value;
    }

    static setVisionRange(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE + 4] = value;
    }
}
