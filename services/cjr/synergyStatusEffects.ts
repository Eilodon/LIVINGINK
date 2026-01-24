/**
 * STATUS EFFECTS EXTENSION - Tattoo Synergy Support
 * 
 * Adding all new status effects required for tattoo synergies
 * This extends the existing Player interface with synergy-specific properties
 */

// Extend Player interface with synergy status effects
declare module '../../types' {
  interface Player {
    // Tattoo Synergy Effects - Phase 2 Gameplay Depth
    neutralPurification?: boolean;
    purificationRadius?: number;
    overdriveExplosive?: boolean;
    explosiveSpeed?: number;
    explosionRadius?: number;
    goldenAttraction?: boolean;
    catalystAttractionRadius?: number;
    goldenMagneticForce?: number;
    elementalBalance?: boolean;
    solventShieldPower?: number;
    shieldSolventSynergy?: boolean;
    colorImmunity?: boolean;
    chromaticImmunityDuration?: number;
    catalystMasteryRadius?: number;
    catalystGuarantee?: boolean;
    neutralGodMode?: boolean;
    kineticExplosion?: boolean;
    explosionDamage?: number;
    shieldPiercing?: boolean;
    absoluteMastery?: boolean;
    colorControl?: number;
    temporalDistortion?: boolean;
    timeManipulation?: number;
    speedAmplifier?: number;
    explosionTimeDilation?: number;
  }
}

// Extend Particle interface with synergy effects
declare module '../../types' {
  interface Particle {
    // Synergy pattern effects
    isSynergyFusion?: boolean;
    fusionColor?: string;
    isSynergyExplosion?: boolean;
    explosionColor?: string;
    isSynergySpiral?: boolean;
    spiralColor?: string;
    isSynergyGeometric?: boolean;
    geometricSides?: number;
    geometricRadius?: number;
    rotationSpeed?: number;
    geometricColor?: string;
    
    // Additional synergy effects
    isSynergyEffect?: boolean;
    synergyColor?: string;
  }
}
