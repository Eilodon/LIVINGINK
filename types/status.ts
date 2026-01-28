export interface StatusTimers {
    tempSpeed: number;
    burn: number;
    slow: number;
    poison: number;
    invulnerable: number;
    rooted: number;
    colorBoost: number;
    overdrive: number;
    magnet: number;
    // Specific Synergies
    catalystEcho: number;
    chromaticImmunity: number;
}

export interface StatusMultipliers {
    speed: number;
    slow: number; // usually < 1
    damage: number;
    defense: number;
    colorBoost: number;
    perfectMatch: number;
    solventPower: number;
    catalystEcho: number;
    neutralMass: number;
    explosiveSpeed: number;
    goldenMagneticForce: number;
    explosionDamage: number;
    speedAmplifier: number;
    explosionTimeDilation: number;
    prismGuardReduction: number;
    pity: number;
}

export interface StatusScalars {
    regen: number;
    stealthCharge: number;
    speedSurge: number; // Flat speed add? Or mult? Logic was: speedBoost.
    kingForm: number;
    commitShield: number;

    // Probabilities & Thresholds
    wrongPigmentReduction: number;
    pigmentBombChance: number;
    perfectMatchThreshold: number;
    prismGuardThreshold: number;

    // Radii / Ranges
    catalystSenseRange: number;
    catalystMasteryRadius: number;
    purificationRadius: number;
    explosionRadius: number;
    catalystAttractionRadius: number;
    magneticFieldRadius: number; // Moved from Player root? Or kept separate?

    // Misc Synergy Powers
    solventShieldPower: number;
    colorControl: number; // 0..1
    timeManipulation: number;
    grimHarvestDropCount: number;
    solventSpeedBoost: number; // Is this a timer value or threshold? logic: max(existing, solventSpeedBoost). It's a cap/value.
}

export const createDefaultStatusTimers = (): StatusTimers => ({
    tempSpeed: 0,
    burn: 0,
    slow: 0,
    poison: 0,
    invulnerable: 0,
    rooted: 0,
    colorBoost: 0,
    overdrive: 0,
    magnet: 0,
    catalystEcho: 0,
    chromaticImmunity: 0,
});

export const createDefaultStatusMultipliers = (): StatusMultipliers => ({
    speed: 1,
    slow: 1,
    damage: 1,
    defense: 1,
    colorBoost: 1,
    perfectMatch: 1,
    solventPower: 1,
    catalystEcho: 1,
    neutralMass: 1,
    explosiveSpeed: 1,
    goldenMagneticForce: 1,
    explosionDamage: 1,
    speedAmplifier: 1,
    explosionTimeDilation: 1,
    prismGuardReduction: 1,
    pity: 1,
});

export const createDefaultStatusScalars = (): StatusScalars => ({
    regen: 0,
    stealthCharge: 0,
    speedSurge: 0,
    kingForm: 0,
    commitShield: 0,
    wrongPigmentReduction: 0,
    pigmentBombChance: 0,
    perfectMatchThreshold: 0.8,
    prismGuardThreshold: 0.8,
    catalystSenseRange: 0,
    catalystMasteryRadius: 0,
    purificationRadius: 0,
    explosionRadius: 0,
    catalystAttractionRadius: 0,
    magneticFieldRadius: 0,
    solventShieldPower: 0,
    colorControl: 0,
    timeManipulation: 0,
    grimHarvestDropCount: 0,
    solventSpeedBoost: 0,
});
