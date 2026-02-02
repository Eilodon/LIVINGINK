# Color Jelly Rush - Project Structure

> **Last Updated:** February 2, 2026
> **Purpose:** Complete reference for project folder organization

---

## Quick Navigation

```
Color-Jelly-Rush/
├── apps/                    # Applications (client & server)
│   ├── client/              # React + Pixi.js game client
│   └── server/              # Colyseus multiplayer server
├── packages/                # Shared packages (monorepo)
│   ├── engine/              # @cjr/engine - Core game logic
│   ├── shared/              # @cjr/shared - Types & constants
│   └── ui/                  # @cjr/ui - Shared UI components
├── tests/                   # Test suites
├── infrastructure/          # Terraform AWS configs
├── k8s/                     # Kubernetes manifests
└── docs/                    # Documentation
```

---

## 1. Apps Directory

### 1.1 Client (`apps/client/`)

```
apps/client/
├── public/                          # Static assets
│   └── favicon.svg
├── src/
│   ├── index.tsx                    # Entry point
│   ├── App.tsx                      # Root component
│   ├── constants.ts                 # Client-specific constants
│   │
│   ├── components/                  # React UI Components
│   │   ├── screens/                 # Full-screen views
│   │   │   ├── BootScreen.tsx       # Initial loading screen
│   │   │   ├── MatchmakingScreen.tsx
│   │   │   ├── LevelSelectScreen.tsx
│   │   │   ├── GameOverScreen.tsx
│   │   │   └── TournamentLobbyScreen.tsx
│   │   ├── overlays/                # Modal/popup overlays
│   │   │   ├── PauseOverlay.tsx
│   │   │   ├── TutorialOverlay.tsx
│   │   │   └── SettingsOverlay.tsx
│   │   ├── ScreenManager.tsx        # Screen state machine
│   │   ├── UiOverlayManager.tsx     # Overlay orchestration
│   │   ├── HUD.tsx                  # In-game heads-up display
│   │   ├── MainMenu.tsx
│   │   ├── MobileControls.tsx
│   │   ├── PixiGameCanvas.tsx       # Pixi.js canvas wrapper
│   │   ├── TattooPicker.tsx
│   │   └── ColorblindOverlay.tsx
│   │
│   ├── hooks/                       # React Custom Hooks
│   │   ├── useGameSession.ts        # Game session lifecycle
│   │   ├── useGameDataBridge.ts     # Engine ↔ React bridge
│   │   ├── useZeroRenderTimer.ts    # Performance timer
│   │   ├── useReducedMotion.ts      # Accessibility
│   │   └── useScreenReaderAnnouncer.ts
│   │
│   ├── game/                        # Game Logic (Client-side)
│   │   ├── engine/                  # Client engine integration
│   │   │   ├── GameStateManager.ts  # Session orchestration
│   │   │   ├── GameLoop.ts          # RAF loop
│   │   │   ├── ClientEngineBridge.ts
│   │   │   ├── RenderBridge.ts
│   │   │   ├── VFXRingBuffer.ts
│   │   │   ├── PhysicsWorld.ts
│   │   │   ├── factories.ts
│   │   │   ├── effects.ts
│   │   │   ├── statusFlags.ts
│   │   │   ├── context.ts
│   │   │   ├── index.ts
│   │   │   ├── dod/                 # Client DOD layer
│   │   │   │   ├── EntityManager.ts
│   │   │   │   ├── EntityFlags.ts
│   │   │   │   ├── ConfigStore.ts
│   │   │   │   ├── EntityStateBridge.ts
│   │   │   │   ├── DODViewHelpers.ts
│   │   │   │   └── systems/
│   │   │   │       ├── SkillSystem.ts
│   │   │   │       └── TattooSystem.ts
│   │   │   └── systems/             # Client-specific systems
│   │   │       ├── skills.ts
│   │   │       ├── mechanics.ts
│   │   │       └── ai.ts
│   │   │
│   │   ├── cjr/                     # CJR Game Mechanics
│   │   │   ├── cjrTypes.ts          # CJR type definitions
│   │   │   ├── tattoos.ts           # Tattoo definitions
│   │   │   ├── tattooEvents.ts
│   │   │   ├── tattooSynergies.ts
│   │   │   ├── synergyDefinitions.ts
│   │   │   ├── shapeSkills.ts       # Shape-based skills
│   │   │   ├── emotions.ts          # Emotion system
│   │   │   ├── levels.ts            # Level configurations
│   │   │   ├── balance.ts           # Balance parameters
│   │   │   ├── contribution.ts      # Contribution tier system
│   │   │   ├── dynamicBounty.ts     # Candy Vein system
│   │   │   ├── botPersonalities.ts  # AI personalities
│   │   │   └── shaders.ts           # GLSL shaders
│   │   │
│   │   ├── renderer/                # Rendering System
│   │   │   ├── RingRenderer.ts
│   │   │   ├── RenderTypes.ts
│   │   │   ├── WebGLCheck.ts
│   │   │   └── backends/            # Render backend abstraction
│   │   │       ├── IRenderBackend.ts
│   │   │       ├── WebGL2Backend.ts
│   │   │       ├── WebGPUBackend.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── vfx/                     # Visual Effects
│   │   │   ├── vfxIntegration.ts
│   │   │   ├── CrystalVFX.ts
│   │   │   └── tattooVFX.ts
│   │   │
│   │   ├── audio/                   # Audio System
│   │   │   └── AudioEngine.ts
│   │   │
│   │   ├── input/                   # Input Handling
│   │   │   └── BufferedInput.ts
│   │   │
│   │   ├── mobile/                  # Mobile Optimization
│   │   │   └── MobilePerformanceTester.ts
│   │   │
│   │   ├── logging/                 # Client Logging
│   │   │   └── ClientLogger.ts
│   │   │
│   │   ├── testing/                 # Testing Utilities
│   │   │   └── ProductionTestSuite.ts
│   │   │
│   │   ├── core/utils/
│   │   │   └── arrayUtils.ts
│   │   │
│   │   ├── combatRules.ts
│   │   ├── haptics.ts
│   │   ├── AssetLoader.ts
│   │   └── __tests__/
│   │
│   ├── network/                     # Networking
│   │   ├── BinaryPacker.ts
│   │   ├── InputRingBuffer.ts
│   │   ├── NetworkTransformBuffer.ts
│   │   └── __tests__/
│   │
│   ├── core/                        # Cross-cutting Concerns
│   │   ├── ui/                      # UI utilities
│   │   │   ├── storage.ts
│   │   │   ├── useLocalStorageState.ts
│   │   │   └── screenMachine.ts
│   │   ├── performance/
│   │   │   └── PerformanceMonitor.ts
│   │   ├── logging/
│   │   │   └── ClientLogger.ts
│   │   ├── analytics/
│   │   │   └── AnalyticsSystem.ts
│   │   ├── monetization/
│   │   │   └── MonetizationSystem.ts
│   │   ├── accessibility/
│   │   │   └── ColorblindMode.ts
│   │   ├── security/
│   │   │   └── ProductionSecurityManager.ts
│   │   ├── utils/
│   │   │   └── arrayUtils.ts
│   │   └── meta/                    # Meta-game systems
│   │       ├── index.ts
│   │       ├── matchmaking.ts
│   │       ├── tournaments.ts
│   │       ├── guilds.ts
│   │       ├── quests.ts
│   │       └── cosmetics.ts
│   │
│   └── types/                       # TypeScript Definitions
│
├── vite.config.ts                   # Vite build config
├── tsconfig.json                    # TypeScript config
├── tailwind.config.js               # Tailwind CSS config
├── postcss.config.js
└── package.json
```

### 1.2 Server (`apps/server/`)

```
apps/server/
├── src/
│   ├── index.ts                     # Server entry point
│   ├── constants.ts
│   ├── cjrTypes.ts
│   │
│   ├── rooms/                       # Colyseus Rooms
│   │   ├── GameRoom.ts              # Main game room
│   │   └── GameRoom.test.ts
│   │
│   ├── schema/                      # Colyseus Schema
│   │   └── GameState.ts             # Sync state schema
│   │
│   ├── engine/                      # Server Engine
│   │   └── ServerEngineBridge.ts    # Engine integration
│   │
│   ├── systems/                     # Server-side Systems
│   │   └── ColorMixingSystem.ts
│   │
│   ├── auth/                        # Authentication
│   │   ├── AuthService.ts
│   │   ├── authRoutes.ts
│   │   └── SessionStore.ts
│   │
│   ├── security/                    # Security Layer
│   │   ├── ServerValidator.ts       # Input validation
│   │   └── RateLimiter.ts
│   │
│   ├── validation/
│   │   └── InputValidator.ts
│   │
│   ├── database/                    # Database Layer
│   │   ├── config.ts
│   │   ├── PostgreSQLManager.ts
│   │   ├── RedisManager.ts
│   │   ├── CacheService.ts
│   │   ├── MigrationManager.ts
│   │   ├── DataMigrationService.ts
│   │   └── migrations/
│   │       └── 001_initial_schema.sql
│   │
│   ├── monitoring/                  # Server Monitoring
│   │   ├── ServerMonitor.ts
│   │   ├── MonitoringService.ts
│   │   └── monitoringRoutes.ts
│   │
│   ├── performance/
│   │   ├── Profiler.ts
│   │   └── Optimizer.ts
│   │
│   ├── logging/
│   │   └── Logger.ts
│   │
│   ├── testing/
│   │   ├── LoadTester.ts
│   │   └── eidolon_benchmark.ts
│   │
│   └── __tests__/
│
├── tsconfig.json
└── package.json
```

---

## 2. Packages Directory

### 2.1 Engine Package (`packages/engine/`)

> **Package Name:** `@cjr/engine`
> **Purpose:** Headless, pure game logic (runs on client AND server)

```
packages/engine/
├── src/
│   ├── index.ts                     # Public API exports
│   ├── Engine.ts                    # Core engine class
│   │
│   ├── dod/                         # Data-Oriented Design
│   │   ├── index.ts
│   │   ├── ComponentStores.ts       # TypedArray stores
│   │   ├── EntityFlags.ts           # Entity bitmask flags
│   │   └── IEntityLookup.ts         # Lookup interface
│   │
│   ├── systems/                     # Pure System Functions
│   │   ├── index.ts
│   │   ├── PhysicsSystem.ts
│   │   ├── MovementSystem.ts
│   │   └── SkillSystem.ts
│   │
│   ├── cjr/                         # CJR Game Logic
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── colorMath.ts             # Color mixing/matching
│   │   ├── ringSystem.ts            # Ring progression
│   │   ├── waveSpawner.ts           # Entity spawning
│   │   ├── winCondition.ts          # Victory logic
│   │   ├── bossCjr.ts               # Boss mechanics
│   │   └── tattoos.ts               # Tattoo upgrades
│   │
│   ├── events/                      # Event System
│   │   ├── index.ts
│   │   └── EventRingBuffer.ts       # Zero-alloc events
│   │
│   ├── config/                      # Configuration
│   │   ├── index.ts
│   │   ├── levels.ts
│   │   └── constants.ts
│   │
│   ├── math/                        # Math Utilities
│   │   ├── index.ts
│   │   └── FastMath.ts
│   │
│   ├── factories/                   # Entity Factories
│   │   ├── index.ts
│   │   └── LogicFactories.ts
│   │
│   ├── networking/                  # Binary Protocol
│   │   ├── index.ts
│   │   ├── BinaryPacker.ts
│   │   └── types.ts
│   │
│   └── __tests__/
│       ├── DODStores.test.ts
│       ├── PhysicsSystem.test.ts
│       ├── EventRingBuffer.test.ts
│       └── BinaryPacker.test.ts
│
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

### 2.2 Shared Package (`packages/shared/`)

> **Package Name:** `@cjr/shared`
> **Purpose:** Types and constants shared between client/server

```
packages/shared/
├── src/
│   ├── index.ts                     # Re-exports all
│   ├── types.ts                     # Core type definitions
│   ├── constants.ts                 # Shared constants
│   ├── engine/
│   │   └── types.ts                 # Engine-specific types
│   └── config/
│       └── PhysicsConfig.ts
│
├── tsconfig.json
└── package.json
```

---

## 3. Tests Directory

```
tests/
├── integration/                     # Integration tests
├── performance/                     # Load & perf tests
└── e2e/                            # Playwright E2E tests
```

---

## 4. Infrastructure

### 4.1 Kubernetes (`k8s/`)

```
k8s/
├── base/                            # Base manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── hpa.yaml                     # Horizontal Pod Autoscaler
├── overlays/
│   ├── staging/
│   └── production/
└── kustomization.yaml
```

### 4.2 Terraform (`infrastructure/`)

```
infrastructure/
└── terraform/                       # AWS infrastructure
    ├── main.tf
    ├── variables.tf
    └── outputs.tf
```

---

## 5. Root Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Monorepo root config, workspaces |
| `tsconfig.json` | Root TypeScript config |
| `Dockerfile` | Multi-stage Docker build |
| `docker-compose.yml` | Local dev environment |
| `.github/workflows/` | CI/CD pipelines |
| `.eslintrc.js` | ESLint configuration |
| `.prettierrc` | Prettier formatting rules |
| `vitest.workspace.ts` | Vitest workspace config |

---

## 6. Module Ownership

| Directory | Owner | Responsibility |
|-----------|-------|----------------|
| `apps/client/src/components/` | UI Team | React components |
| `apps/client/src/game/engine/` | Engine Team | Client engine |
| `apps/client/src/game/cjr/` | Game Design | CJR mechanics |
| `apps/server/src/rooms/` | Backend Team | Multiplayer rooms |
| `packages/engine/` | Engine Team | Core engine |
| `packages/shared/` | All Teams | Shared contracts |

---

## 7. File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| React Component | `PascalCase.tsx` | `GameCanvas.tsx` |
| React Hook | `useCamelCase.ts` | `useGameSession.ts` |
| System | `PascalCaseSystem.ts` | `PhysicsSystem.ts` |
| Store | `PascalCaseStore.ts` | `TransformStore.ts` |
| Types | `camelCase.ts` | `cjrTypes.ts` |
| Constants | `camelCase.ts` | `constants.ts` |
| Tests | `*.test.ts` | `PhysicsSystem.test.ts` |

---

**End of Document**
