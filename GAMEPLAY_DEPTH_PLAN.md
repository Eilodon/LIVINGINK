# GAMEPLAY DEPTH IMPLEMENTATION PLAN

## Advanced Mechanics:

### 1. Tattoo Synergies
```typescript
interface TattooSynergy {
  tattoos: [TattooId, TattooId];
  effect: (player: Player) => void;
  description: string;
}

const TATTOO_SYNERGIES: TattooSynergy[] = [
  {
    tattoos: [TattooId.FilterInk, TattooId.NeutralMastery],
    effect: (player) => {
      // Neutral pickups also cleanse wrong pigments
      player.statusEffects.neutralCleanse = true;
    },
    description: "Neutral pickups now cleanse wrong colors"
  },
  {
    tattoos: [TattooId.Overdrive, TattooId.PigmentBomb],
    effect: (player) => {
      // Overdrive triggers PigmentBomb on every hit
      player.statusEffects.overdriveBomb = true;
    },
    description: "Overdrive attacks splash color on enemies"
  }
];
```

### 2. Skill Combo System
```typescript
interface SkillCombo {
  sequence: ShapeId[];
  effect: (player: Player, state: GameState) => void;
  cooldown: number;
  description: string;
}

const SKILL_COMBOS: SkillCombo[] = [
  {
    sequence: [ShapeId.Circle, ShapeId.Triangle],
    effect: (player, state) => {
      // Dash + Strike = Teleport Strike
      player.statusEffects.teleportStrike = true;
    },
    cooldown: 10.0,
    description: "Teleport behind enemy and strike"
  }
];
```

### 3. Color Mastery System
```typescript
interface ColorMastery {
  perfectMatches: number;
  currentStreak: number;
  bonuses: {
    speedBoost: number;
    massBonus: number;
    specialAbilities: string[];
  };
}

// Advanced color mixing techniques
const ADVANCED_MIXING = {
  complementary: { r: 1, g: 0, b: 0 }, // Red + Green bonus
  triadic: { r: 1, g: 1, b: 1 },     // RGB balance bonus
  analogous: { r: 0.8, g: 0.6, b: 0 }  // Warm color bonus
};
```

## Meta Progression:

### 1. Tattoo Collection System
```typescript
interface TattooRarity {
  common: 60%;    // Basic tattoos
  rare: 30%;      // Enhanced effects  
  epic: 9%;       // Game-changing abilities
  legendary: 1%;  // Unique powers
}

interface CollectionProgress {
  ownedTattoos: TattooId[];
  duplicates: Map<TattooId, number>;
  upgradeTokens: number;
  unlockedSlots: number;
}
```

### 2. Shape Mastery Paths
```typescript
interface ShapeMastery {
  circle: {
    level: number;
    abilities: ['quick_escape', 'momentum_dash', 'phase_shift'];
    ultimate: 'warp_dash';
  },
  triangle: {
    level: number;
    abilities: ['critical_strike', 'armor_pierce', 'execute'];
    ultimate: 'assassinate';
  }
  // ... other shapes
}
```

### 3. Achievement System
```typescript
interface Achievement {
  id: string;
  name: string;
  description: string;
  requirement: (state: GameState) => boolean;
  reward: {
    unlockTattoos?: TattooId[];
    bonusCurrency?: number;
    specialEffects?: string[];
  };
}
```

## Strategic Depth:

### 1. Build Diversity System
```typescript
interface BuildArchetype {
  name: string;
  recommendedTattoos: TattooId[];
  playstyle: 'aggressive' | 'defensive' | 'utility' | 'hybrid';
  strengths: string[];
  weaknesses: string[];
  counterBuilds: string[];
}

const BUILD_ARCHETYPES: BuildArchetype[] = [
  {
    name: "Speed Runner",
    recommendedTattoos: [TattooId.Overdrive, TattooId.CatalystSense],
    playstyle: 'aggressive',
    strengths: ['fast progression', 'hit-and-run'],
    weaknesses: ['low health', 'vulnerable to traps'],
    counterBuilds: ['Tank', 'Control']
  }
];
```

### 2. Environmental Hazards
```typescript
interface EnvironmentalHazard {
  type: 'color_storm' | 'gravity_well' | 'pigment_mine';
  position: Vector2;
  radius: number;
  effect: (entity: Player | Bot) => void;
  duration: number;
  warning: VisualEffect;
}
```

### 3. Adaptive Boss AI
```typescript
interface AdaptiveAI {
  playerPatterns: Map<string, number>;
  learnedCounters: Map<string, string>;
  difficulty: number;
  adaptationSpeed: number;
  
  analyzePlayerPattern(player: Player): void;
  selectCounter(): string;
  adjustDifficulty(): void;
}
```

## Risk/Reward Mechanics:

### 1. High-Risk Strategies
```typescript
interface RiskMechanic {
  name: string;
  risk: string;
  reward: string;
  trigger: (player: Player) => boolean;
  effect: (player: Player) => void;
}

const RISK_MECHANICS: RiskMechanic[] = [
  {
    name: "Glass Cannon",
    risk: "50% health reduction",
    reward: "2x damage output",
    trigger: (p) => p.radius < 20,
    effect: (p) => {
      p.currentHealth *= 0.5;
      p.damageMultiplier *= 2.0;
    }
  }
];
```

### 2. Combo Multipliers
```typescript
interface ComboSystem {
  currentCombo: number;
  maxCombo: number;
  multiplier: number;
  actions: string[];
  
  addAction(action: string): void;
  breakCombo(): void;
  calculateMultiplier(): number;
}
```

## Implementation Timeline: 4-5 days
- Day 1: Tattoo synergies + skill combos
- Day 2: Color mastery + meta progression  
- Day 3: Build system + achievements
- Day 4: Environmental hazards + adaptive AI
- Day 5: Risk/reward mechanics + balance tuning
