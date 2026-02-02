# Color Jelly Rush - Module Dependency Map

> **Last Updated:** February 2, 2026
> **Purpose:** Visual guide to module dependencies and import paths

---

## 1. High-Level Architecture

```
                              ┌─────────────────────────────────────┐
                              │           APPLICATIONS              │
                              └─────────────────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      │                      ▼
    ┌───────────────────────┐              │      ┌───────────────────────┐
    │    apps/client        │              │      │    apps/server        │
    │    (React + Pixi.js)  │              │      │    (Express+Colyseus) │
    └───────────────────────┘              │      └───────────────────────┘
                │                          │                      │
                │                          │                      │
                └──────────────────────────┼──────────────────────┘
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                              ▼                         ▼
                ┌─────────────────────┐   ┌─────────────────────┐
                │   @cjr/engine       │   │   @cjr/shared       │
                │   (Game Logic)      │   │   (Types/Constants) │
                └─────────────────────┘   └─────────────────────┘
                              │                         │
                              └────────────┬────────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │   External Libraries    │
                              │   (Pixi.js, Colyseus)   │
                              └─────────────────────────┘
```

---

## 2. Package Dependencies

### 2.1 Dependency Matrix

| Package | Depends On | Used By |
|---------|------------|---------|
| `@cjr/shared` | None (leaf) | `@cjr/engine`, `apps/client`, `apps/server` |
| `@cjr/engine` | `@cjr/shared` | `apps/client`, `apps/server` |
| `apps/client` | `@cjr/shared`, `@cjr/engine`, `pixi.js`, `colyseus.js`, `react` | - |
| `apps/server` | `@cjr/shared`, `@cjr/engine`, `colyseus`, `express`, `pg`, `redis` | - |

### 2.2 Import Direction Rules

```
     ALLOWED                          FORBIDDEN
     ========                          =========

  ┌─────────────┐                   ┌─────────────┐
  │ apps/client │                   │ apps/client │
  └──────┬──────┘                   └──────┬──────┘
         │                                 ▲
         │ ✅ Can import                   │ ❌ Cannot import
         ▼                                 │
  ┌─────────────┐                   ┌──────┴──────┐
  │ @cjr/engine │                   │ @cjr/engine │
  └──────┬──────┘                   └─────────────┘
         │
         │ ✅ Can import
         ▼
  ┌─────────────┐
  │ @cjr/shared │  ← Leaf node, no outgoing deps
  └─────────────┘
```

---

## 3. Client Application Module Map

```
apps/client/src/
│
├── index.tsx ◄────────────────────── ENTRY POINT
│       │
│       └─► App.tsx
│               │
│               ├─► components/ScreenManager.tsx
│               │       │
│               │       ├─► screens/BootScreen.tsx
│               │       ├─► screens/MatchmakingScreen.tsx
│               │       └─► screens/GameOverScreen.tsx
│               │
│               ├─► components/PixiGameCanvas.tsx
│               │       │
│               │       └─► game/renderer/backends/*
│               │
│               └─► hooks/useGameSession.ts
│                       │
│                       └─► game/engine/GameStateManager.ts
│                               │
│                               ├─► game/engine/GameLoop.ts
│                               ├─► game/engine/ClientEngineBridge.ts
│                               │       │
│                               │       └─► @cjr/engine (Engine class)
│                               │
│                               └─► network/*
```

### 3.1 Client Module Categories

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│  components/screens/*     │ Full-screen views                       │
│  components/overlays/*    │ Modal popups                            │
│  components/HUD.tsx       │ In-game UI                              │
│  components/*.tsx         │ Reusable UI components                  │
├─────────────────────────────────────────────────────────────────────┤
│                           HOOKS LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│  hooks/useGameSession.ts       │ Session lifecycle                  │
│  hooks/useGameDataBridge.ts    │ Engine ↔ React bridge              │
│  hooks/useZeroRenderTimer.ts   │ Performance-safe timers            │
├─────────────────────────────────────────────────────────────────────┤
│                          GAME ENGINE LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│  game/engine/GameStateManager.ts  │ Session orchestrator            │
│  game/engine/GameLoop.ts          │ RAF loop                        │
│  game/engine/ClientEngineBridge.ts│ Links to @cjr/engine            │
│  game/engine/dod/*                │ Client DOD stores               │
├─────────────────────────────────────────────────────────────────────┤
│                         CJR MECHANICS LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│  game/cjr/tattoos.ts           │ Tattoo definitions                 │
│  game/cjr/shapeSkills.ts       │ Shape-based skills                 │
│  game/cjr/emotions.ts          │ Emotion system                     │
│  game/cjr/contribution.ts      │ Boss contribution tiers            │
├─────────────────────────────────────────────────────────────────────┤
│                          RENDERING LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  game/renderer/backends/       │ Render backend abstraction         │
│  game/vfx/*                    │ Visual effects system              │
├─────────────────────────────────────────────────────────────────────┤
│                          NETWORK LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│  network/BinaryPacker.ts       │ Binary message encoding            │
│  network/InputRingBuffer.ts    │ Input buffering                    │
│  network/NetworkTransformBuffer│ Position interpolation             │
├─────────────────────────────────────────────────────────────────────┤
│                           CORE LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│  core/analytics/*              │ Telemetry                          │
│  core/accessibility/*          │ A11y features                      │
│  core/security/*               │ Client security                    │
│  core/meta/*                   │ Meta-game systems                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Server Application Module Map

```
apps/server/src/
│
├── index.ts ◄────────────────────── ENTRY POINT
│       │
│       ├─► Express + Helmet (security headers)
│       ├─► Colyseus Server
│       │       │
│       │       └─► rooms/GameRoom.ts
│       │               │
│       │               ├─► engine/ServerEngineBridge.ts
│       │               │       │
│       │               │       └─► @cjr/engine (Engine class)
│       │               │
│       │               ├─► schema/GameState.ts (Colyseus Schema)
│       │               └─► systems/ColorMixingSystem.ts
│       │
│       ├─► auth/authRoutes.ts
│       │       │
│       │       ├─► auth/AuthService.ts
│       │       └─► auth/SessionStore.ts (Redis)
│       │
│       ├─► monitoring/monitoringRoutes.ts
│       │
│       └─► database/*
│               │
│               ├─► PostgreSQLManager.ts
│               └─► RedisManager.ts
```

---

## 5. Engine Package Module Map

```
@cjr/engine (packages/engine/src/)
│
├── index.ts ◄────────────────────── PUBLIC API
│       │
│       ├─► dod/
│       │   ├── index.ts
│       │   ├── ComponentStores.ts   ← TypedArray storage
│       │   ├── EntityFlags.ts       ← Bitmask flags
│       │   └── IEntityLookup.ts     ← Lookup interface
│       │
│       ├─► systems/
│       │   ├── index.ts
│       │   ├── PhysicsSystem.ts     ← Position updates
│       │   ├── MovementSystem.ts    ← Velocity from input
│       │   └── SkillSystem.ts       ← Skill execution
│       │
│       ├─► cjr/
│       │   ├── index.ts
│       │   ├── colorMath.ts         ← Color mixing/matching
│       │   ├── ringSystem.ts        ← Ring progression
│       │   ├── waveSpawner.ts       ← Entity spawning
│       │   ├── winCondition.ts      ← Victory check
│       │   ├── bossCjr.ts           ← Boss mechanics
│       │   └── tattoos.ts           ← Upgrade system
│       │
│       ├─► events/
│       │   ├── index.ts
│       │   └── EventRingBuffer.ts   ← Zero-alloc event queue
│       │
│       ├─► config/
│       │   ├── index.ts
│       │   ├── levels.ts            ← Level configurations
│       │   └── constants.ts
│       │
│       ├─► math/
│       │   └── FastMath.ts          ← Optimized math utils
│       │
│       ├─► networking/
│       │   ├── BinaryPacker.ts      ← Binary protocol
│       │   └── types.ts
│       │
│       └─► factories/
│           └── LogicFactories.ts    ← Entity creation
```

---

## 6. Shared Package Module Map

```
@cjr/shared (packages/shared/src/)
│
├── index.ts ◄────────────────────── PUBLIC API
│       │
│       ├─► constants.ts      ← Game-wide constants
│       ├─► types.ts          ← Core type definitions
│       │
│       ├─► engine/
│       │   └── types.ts      ← Engine-specific types
│       │
│       └─► config/
│           └── PhysicsConfig.ts  ← Physics parameters
```

---

## 7. Cross-Package Imports

### 7.1 From Client

```typescript
// Importing from @cjr/engine
import {
  Engine,
  TransformStore,
  PhysicsStore,
  EntityFlags,
  PhysicsSystem,
  MovementSystem,
  eventBuffer,
  EngineEventType,
  mixPigment,
  calcMatchPercent,
  getRingAtPosition
} from '@cjr/engine';

// Importing from @cjr/shared
import {
  MAX_PLAYERS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  EntityType,
  SkillType
} from '@cjr/shared';

// Internal aliases
import { GameStateManager } from '@/game/engine/GameStateManager';
import { HUD } from '@components/HUD';
```

### 7.2 From Server

```typescript
// Importing from @cjr/engine
import {
  Engine,
  TransformStore,
  PhysicsSystem,
  BinaryPacker
} from '@cjr/engine';

// Importing from @cjr/shared
import {
  GameConfig,
  EntityType
} from '@cjr/shared';
```

---

## 8. Circular Dependency Prevention

### 8.1 Forbidden Patterns

```
❌ apps/client → apps/server
❌ @cjr/engine → apps/*
❌ @cjr/shared → @cjr/engine
❌ @cjr/shared → apps/*
```

### 8.2 Detection

Run ESLint with import-cycle detection:
```bash
npm run lint -- --rule 'import/no-cycle: error'
```

---

## 9. Vite Alias Configuration

```typescript
// apps/client/vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@cjr/shared': path.resolve(__dirname, '../../packages/shared/src'),
    '@cjr/engine': path.resolve(__dirname, '../../packages/engine/src'),
    '@services': path.resolve(__dirname, './src/services'),
    '@components': path.resolve(__dirname, './src/components'),
  },
}
```

---

## 10. TypeScript Path Aliases

```json
// apps/client/tsconfig.json
{
  "compilerOptions": {
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

---

## 11. Module Export Rules

### @cjr/engine Exports

| Module | What to Export | What NOT to Export |
|--------|----------------|-------------------|
| `dod/` | Stores, EntityFlags, MAX_ENTITIES | Internal helpers |
| `systems/` | System update functions | Internal state |
| `cjr/` | Public game logic functions | Implementation details |
| `events/` | eventBuffer, EventTypes | Buffer internals |

### @cjr/shared Exports

| Module | What to Export |
|--------|----------------|
| `constants.ts` | All constants |
| `types.ts` | All type definitions |

---

**End of Document**
