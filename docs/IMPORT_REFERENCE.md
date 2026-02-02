# Color Jelly Rush - Import Reference Guide

> **Last Updated:** February 2, 2026
> **Purpose:** Definitive guide for correct import paths after refactoring

---

## 1. Quick Reference Table

| What You Need | Import From | Example |
|---------------|-------------|---------|
| DOD Stores | `@cjr/engine` | `import { TransformStore } from '@cjr/engine'` |
| Systems | `@cjr/engine` | `import { PhysicsSystem } from '@cjr/engine'` |
| CJR Game Logic | `@cjr/engine` | `import { mixPigment } from '@cjr/engine'` |
| Shared Types | `@cjr/shared` | `import { EntityType } from '@cjr/shared'` |
| Shared Constants | `@cjr/shared` | `import { MAX_PLAYERS } from '@cjr/shared'` |
| Local Components | `@/components/*` | `import { HUD } from '@/components/HUD'` |
| Local Hooks | `@/hooks/*` | `import { useGameSession } from '@/hooks/useGameSession'` |
| Game Engine | `@/game/engine/*` | `import { GameStateManager } from '@/game/engine/GameStateManager'` |

---

## 2. Package Imports

### 2.1 From `@cjr/engine`

```typescript
// === DOD Module ===
import {
  // Entity Flags
  EntityFlags,
  MAX_ENTITIES,

  // Component Stores (TypedArrays)
  TransformStore,
  PhysicsStore,
  StateStore,
  StatsStore,
  SkillStore,
  TattooStore,
  ProjectileStore,
  ConfigStore,
  InputStore,
  resetAllStores,

  // Entity Lookup
  type IEntityLookup,
  type IEngineEntity,
  createArrayLookup,
  createMapLookup,
} from '@cjr/engine';

// === Systems Module ===
import {
  PhysicsSystem,
  MovementSystem,
  SkillSystem,
  ShapeEnum,
} from '@cjr/engine';

// === CJR Game Logic ===
import {
  // Color Math
  getColorHint,
  calcMatchPercent,
  calcMatchPercentFast,
  mixPigment,
  pigmentToInt,
  pigmentToHex,
  hexToInt,
  intToHex,
  intToRgbString,
  getSnapAlpha,

  // Ring System
  getRingAtPosition,
  updateRingLogic,
  checkRingTransition,
  type IRingEntity,

  // Tattoos
  getTattooById,
  applyTattoo,
  triggerTattooOnSkill,
  triggerTattooOnHit,
  triggerTattooOnConsume,
  triggerTattooOnUpdate,
  getTattooChoices,
  getAllTattoos,
  TattooFlag,
  StatusFlag,
  type TattooDefinition,

  // Win Condition
  updateWinConditionLogic,
  updateWinCondition,
  type IWinEntity,
  type IWinState,

  // Boss Logic
  updateBossLogic,
  resetBossState,
  isRushWindowActive,
  getRushThreshold,
  onBossDeath,
  type IBossEntity,

  // Wave Spawner
  updateWaveSpawner,
  resetWaveTimers,
  spawnFoodAt,
  type IFood,
  type IWaveState,
} from '@cjr/engine';

// === Events Module ===
import {
  eventBuffer,
  EngineEventType,
  type EngineEvent,
} from '@cjr/engine';

// === Config Module ===
import {
  getLevelConfig,
  PHYSICS_CONSTANTS,
} from '@cjr/engine';

// === Math Module ===
import {
  FastMath,
} from '@cjr/engine';

// === Networking Module ===
import {
  BinaryPacker,
  type PackedInput,
} from '@cjr/engine';

// === Factories Module ===
import {
  createLogicEntity,
} from '@cjr/engine';

// === Engine Class ===
import { Engine } from '@cjr/engine';
```

### 2.2 From `@cjr/shared`

```typescript
import {
  // Types
  type EntityType,
  type SkillType,
  type ShapeId,
  type Pigment,
  type Vector2,

  // Constants
  MAX_PLAYERS,
  MAX_BOTS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  TICK_RATE,

  // Config
  PhysicsConfig,
} from '@cjr/shared';
```

---

## 3. Client Application Imports

### 3.1 Path Aliases (Vite)

```typescript
// @/ → apps/client/src/
import { HUD } from '@/components/HUD';
import { useGameSession } from '@/hooks/useGameSession';
import { GameStateManager } from '@/game/engine/GameStateManager';

// @components/ → apps/client/src/components/
import { ScreenManager } from '@components/ScreenManager';
import { MainMenu } from '@components/MainMenu';

// @services/ → apps/client/src/services/
import { AuthService } from '@services/AuthService';
```

### 3.2 Component Imports

```typescript
// Screens
import { BootScreen } from '@/components/screens/BootScreen';
import { MatchmakingScreen } from '@/components/screens/MatchmakingScreen';
import { LevelSelectScreen } from '@/components/screens/LevelSelectScreen';
import { GameOverScreen } from '@/components/screens/GameOverScreen';
import { TournamentLobbyScreen } from '@/components/screens/TournamentLobbyScreen';

// Overlays
import { PauseOverlay } from '@/components/overlays/PauseOverlay';
import { TutorialOverlay } from '@/components/overlays/TutorialOverlay';
import { SettingsOverlay } from '@/components/overlays/SettingsOverlay';

// Core Components
import { ScreenManager } from '@/components/ScreenManager';
import { UiOverlayManager } from '@/components/UiOverlayManager';
import { HUD } from '@/components/HUD';
import { MainMenu } from '@/components/MainMenu';
import { MobileControls } from '@/components/MobileControls';
import { PixiGameCanvas } from '@/components/PixiGameCanvas';
import { TattooPicker } from '@/components/TattooPicker';
import { ColorblindOverlay } from '@/components/ColorblindOverlay';
```

### 3.3 Hook Imports

```typescript
import { useGameSession } from '@/hooks/useGameSession';
import { useGameDataBridge } from '@/hooks/useGameDataBridge';
import { useZeroRenderTimer } from '@/hooks/useZeroRenderTimer';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useScreenReaderAnnouncer } from '@/hooks/useScreenReaderAnnouncer';
```

### 3.4 Game Engine Imports

```typescript
// Engine Core
import { GameStateManager, gameStateManager } from '@/game/engine/GameStateManager';
import { FixedGameLoop } from '@/game/engine/GameLoop';
import { ClientEngineBridge } from '@/game/engine/ClientEngineBridge';
import { RenderBridge } from '@/game/engine/RenderBridge';
import { VFXRingBuffer } from '@/game/engine/VFXRingBuffer';
import { PhysicsWorld } from '@/game/engine/PhysicsWorld';
import { createInitialState } from '@/game/engine/index';

// Client DOD
import { EntityManager } from '@/game/engine/dod/EntityManager';
import { EntityFlags } from '@/game/engine/dod/EntityFlags';
import { ConfigStore } from '@/game/engine/dod/ConfigStore';
import { EntityStateBridge } from '@/game/engine/dod/EntityStateBridge';
import { DODViewHelpers } from '@/game/engine/dod/DODViewHelpers';

// Client DOD Stores (DUPLICATED for client-specific extensions)
import {
  TransformStore,
  PhysicsStore,
  InputStore,
  resetAllStores,
} from '@/game/engine/dod/ComponentStores';

// Client Systems
import { SkillSystem } from '@/game/engine/dod/systems/SkillSystem';
import { TattooSystem } from '@/game/engine/dod/systems/TattooSystem';
```

### 3.5 CJR Mechanics Imports

```typescript
// Types
import { ShapeId, Emotion, TattooId } from '@/game/cjr/cjrTypes';

// Tattoos
import { TATTOO_DEFINITIONS, getTattooDefinition } from '@/game/cjr/tattoos';
import { checkTattooSynergies } from '@/game/cjr/tattooSynergies';
import { SYNERGY_DEFINITIONS } from '@/game/cjr/synergyDefinitions';
import { onTattooEvent } from '@/game/cjr/tattooEvents';

// Skills
import { SHAPE_SKILLS, getShapeSkill } from '@/game/cjr/shapeSkills';

// Emotions
import { EMOTIONS, getEmotion, updateEmotion } from '@/game/cjr/emotions';

// Levels
import { LEVEL_CONFIGS, getLevelConfig } from '@/game/cjr/levels';

// Balance
import { BALANCE } from '@/game/cjr/balance';

// Contribution
import { calculateContribution, getContributionTier } from '@/game/cjr/contribution';

// Dynamic Bounty
import { updateDynamicBounty, getCandyVeinState } from '@/game/cjr/dynamicBounty';

// Bot AI
import { BOT_PERSONALITIES, getBotPersonality } from '@/game/cjr/botPersonalities';

// Shaders
import { SHADERS, compileShader } from '@/game/cjr/shaders';
```

### 3.6 Renderer Imports

```typescript
import { RingRenderer } from '@/game/renderer/RingRenderer';
import { RenderTypes } from '@/game/renderer/RenderTypes';
import { checkWebGLSupport } from '@/game/renderer/WebGLCheck';

// Backends
import { IRenderBackend } from '@/game/renderer/backends/IRenderBackend';
import { WebGL2Backend } from '@/game/renderer/backends/WebGL2Backend';
import { WebGPUBackend } from '@/game/renderer/backends/WebGPUBackend';
import { createRenderBackend } from '@/game/renderer/backends/index';
```

### 3.7 VFX Imports

```typescript
import { vfxIntegrationManager } from '@/game/vfx/vfxIntegration';
import { CrystalVFX } from '@/game/vfx/CrystalVFX';
import { TattooVFX } from '@/game/vfx/tattooVFX';
```

### 3.8 Audio Imports

```typescript
import { AudioEngine, audioEngine } from '@/game/audio/AudioEngine';
```

### 3.9 Input Imports

```typescript
import { BufferedInput } from '@/game/input/BufferedInput';
```

### 3.10 Network Imports

```typescript
import { BinaryPacker } from '@/network/BinaryPacker';
import { InputRingBuffer } from '@/network/InputRingBuffer';
import { NetworkTransformBuffer } from '@/network/NetworkTransformBuffer';
```

### 3.11 Core Utilities Imports

```typescript
// UI
import { storage, getStorage, setStorage } from '@/core/ui/storage';
import { useLocalStorageState } from '@/core/ui/useLocalStorageState';
import { screenMachine } from '@/core/ui/screenMachine';

// Performance
import { PerformanceMonitor, performanceMonitor } from '@/core/performance/PerformanceMonitor';

// Logging
import { ClientLogger, clientLogger } from '@/core/logging/ClientLogger';

// Analytics
import { AnalyticsSystem, analytics } from '@/core/analytics/AnalyticsSystem';

// Monetization
import { MonetizationSystem } from '@/core/monetization/MonetizationSystem';

// Accessibility
import { ColorblindMode, colorblindMode } from '@/core/accessibility/ColorblindMode';

// Security
import { ProductionSecurityManager } from '@/core/security/ProductionSecurityManager';

// Utils
import { filterInPlace, removeFirst } from '@/core/utils/arrayUtils';

// Meta-game
import { matchmaking, tournaments, guilds, quests, cosmetics } from '@/core/meta/index';
```

---

## 4. Server Application Imports

### 4.1 Core Imports

```typescript
// Entry point dependencies
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
```

### 4.2 Room Imports

```typescript
import { GameRoom } from './rooms/GameRoom';
```

### 4.3 Engine Bridge

```typescript
import { ServerEngineBridge } from './engine/ServerEngineBridge';

// From shared engine
import {
  Engine,
  TransformStore,
  PhysicsSystem,
  BinaryPacker,
} from '@cjr/engine';
```

### 4.4 Schema Imports

```typescript
import { GameStateSchema } from './schema/GameState';
```

### 4.5 Auth Imports

```typescript
import { AuthService, authService } from './auth/AuthService';
import { authRoutes } from './auth/authRoutes';
import { SessionStore, sessionStore } from './auth/SessionStore';
```

### 4.6 Security Imports

```typescript
import { ServerValidator } from './security/ServerValidator';
import { RateLimiter, rateLimiter } from './security/RateLimiter';
```

### 4.7 Database Imports

```typescript
import { dbConfig } from './database/config';
import { PostgreSQLManager, db } from './database/PostgreSQLManager';
import { RedisManager, redis } from './database/RedisManager';
import { CacheService, cache } from './database/CacheService';
import { MigrationManager } from './database/MigrationManager';
```

### 4.8 Monitoring Imports

```typescript
import { ServerMonitor, serverMonitor } from './monitoring/ServerMonitor';
import { MonitoringService } from './monitoring/MonitoringService';
import { monitoringRoutes } from './monitoring/monitoringRoutes';
```

---

## 5. Common Import Mistakes (and Fixes)

### 5.1 Wrong: Importing from wrong package

```typescript
// WRONG: Importing client-specific from engine
import { VFXRingBuffer } from '@cjr/engine';  // VFX is client-only!

// CORRECT: Import from client
import { VFXRingBuffer } from '@/game/engine/VFXRingBuffer';
```

### 5.2 Wrong: Using relative paths for packages

```typescript
// WRONG: Relative path to package
import { Engine } from '../../packages/engine/src/Engine';

// CORRECT: Use alias
import { Engine } from '@cjr/engine';
```

### 5.3 Wrong: Importing internal module directly

```typescript
// WRONG: Importing internal file
import { TransformStore } from '@cjr/engine/dod/ComponentStores';

// CORRECT: Import from package root
import { TransformStore } from '@cjr/engine';
```

### 5.4 Wrong: Circular dependency

```typescript
// WRONG: Client imports server
import { GameRoom } from '../../../apps/server/src/rooms/GameRoom';

// CORRECT: Use shared types
import { RoomState } from '@cjr/shared';
```

### 5.5 Wrong: Mixing DOD stores

```typescript
// WRONG: Using client DOD in engine package
// In packages/engine/src/systems/PhysicsSystem.ts
import { TransformStore } from '@/game/engine/dod/ComponentStores';

// CORRECT: Use package's own stores
import { TransformStore } from '../dod/ComponentStores';
```

---

## 6. TypeScript Configuration

### 6.1 Client tsconfig.json Paths

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@cjr/shared": ["../../packages/shared/src"],
      "@cjr/engine": ["../../packages/engine/src"],
      "@services/*": ["./src/services/*"],
      "@components/*": ["./src/components/*"]
    }
  }
}
```

### 6.2 Server tsconfig.json Paths

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@cjr/shared": ["../../packages/shared/src"],
      "@cjr/engine": ["../../packages/engine/src"]
    }
  }
}
```

---

## 7. Vite Alias Configuration

```typescript
// apps/client/vite.config.ts
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@cjr/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@cjr/engine': path.resolve(__dirname, '../../packages/engine/src'),
      '@services': path.resolve(__dirname, './src/services'),
      '@components': path.resolve(__dirname, './src/components'),
    },
  },
});
```

---

## 8. Import Order Convention

```typescript
// 1. External packages (node_modules)
import React, { useState, useEffect } from 'react';
import { Application } from 'pixi.js';
import { Client } from 'colyseus.js';

// 2. Monorepo packages (@cjr/*)
import { Engine, TransformStore } from '@cjr/engine';
import { EntityType, MAX_PLAYERS } from '@cjr/shared';

// 3. Absolute imports (@/*)
import { GameStateManager } from '@/game/engine/GameStateManager';
import { HUD } from '@/components/HUD';
import { useGameSession } from '@/hooks/useGameSession';

// 4. Relative imports (./)
import { localHelper } from './helpers';
import type { LocalType } from './types';

// 5. Style imports
import './styles.css';
```

---

## 9. Re-export Pattern

When creating module index files:

```typescript
// packages/engine/src/dod/index.ts

// Named exports (preferred)
export { EntityFlags, MAX_ENTITIES } from './EntityFlags';
export { TransformStore, PhysicsStore } from './ComponentStores';

// Type exports
export type { IEntityLookup, IEngineEntity } from './IEntityLookup';

// Factory exports
export { createArrayLookup, createMapLookup } from './IEntityLookup';
```

---

## 10. Troubleshooting

### "Cannot find module '@cjr/engine'"

1. Check `tsconfig.json` paths are correct
2. Check `vite.config.ts` aliases match
3. Run `npm install` in root to link workspaces

### "Module has no exported member 'X'"

1. Check the export exists in the package's `index.ts`
2. Check for typos in the import name
3. Verify the function/type is actually exported (not internal)

### "Circular dependency detected"

1. Move shared types to `@cjr/shared`
2. Use interfaces instead of concrete implementations
3. Use dependency injection pattern

---

**End of Document**
