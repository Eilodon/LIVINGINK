# Color Jelly Rush - Development Guide

> **Last Updated:** February 2, 2026
> **Purpose:** Setup, conventions, and workflows for developers

---

## 1. Quick Start

### 1.1 Prerequisites

- **Node.js:** 20.x LTS (required)
- **npm:** 10.x+ (comes with Node)
- **Git:** 2.40+
- **Docker:** 24.x+ (for local databases)
- **VS Code:** Recommended IDE

### 1.2 Initial Setup

```bash
# Clone repository
git clone https://github.com/yourorg/Color-Jelly-Rush.git
cd Color-Jelly-Rush

# Install dependencies (all workspaces)
npm install

# Start development servers
npm run dev
```

### 1.3 Development URLs

| Service | URL | Port |
|---------|-----|------|
| Client (Vite) | http://localhost:5173 | 5173 |
| Server (Colyseus) | http://localhost:2567 | 2567 |
| Colyseus Monitor | http://localhost:2567/colyseus | 2567 |

---

## 2. Project Commands

### 2.1 Root Commands

```bash
# Development (all workspaces)
npm run dev

# Build all
npm run build

# Test all
npm run test

# Lint all
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check
```

### 2.2 Client Commands

```bash
cd apps/client

npm run dev        # Start Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run test       # Run Vitest tests
npm run lint       # Lint client code
```

### 2.3 Server Commands

```bash
cd apps/server

npm run dev        # Start with tsx watch
npm run start      # Production start
npm run prod       # Run compiled JS
npm run test       # Run server tests
```

### 2.4 Package Commands

```bash
cd packages/engine

npm run build      # Build engine package
npm run test       # Test engine
npm run lint       # Lint engine
```

---

## 3. Development Workflow

### 3.1 Feature Development

```
1. Create feature branch
   git checkout -b feature/my-feature

2. Make changes
   - Follow coding conventions
   - Write tests for new code
   - Update documentation if needed

3. Run tests locally
   npm run test

4. Commit with conventional commits
   git commit -m "feat: add new player skill"

5. Push and create PR
   git push -u origin feature/my-feature
```

### 3.2 Conventional Commits

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code refactoring |
| `perf:` | Performance improvement |
| `test:` | Adding tests |
| `docs:` | Documentation |
| `chore:` | Maintenance tasks |
| `style:` | Code style changes |

**Examples:**
```bash
git commit -m "feat: add magnet skill for hex shape"
git commit -m "fix: correct collision detection at map edges"
git commit -m "perf: optimize physics loop with SIMD"
git commit -m "docs: update systems overview"
```

### 3.3 Branch Naming

| Pattern | Use For |
|---------|---------|
| `feature/description` | New features |
| `fix/description` | Bug fixes |
| `refactor/description` | Refactoring |
| `perf/description` | Performance |
| `docs/description` | Documentation |

---

## 4. Coding Conventions

### 4.1 TypeScript Guidelines

```typescript
// Use interfaces for public APIs
interface PlayerConfig {
  name: string;
  shape: ShapeId;
  level: number;
}

// Use type for unions/intersections
type EntityId = string | number;

// Prefer const assertions
const SHAPES = ['circle', 'square', 'triangle', 'hex'] as const;

// Use enums sparingly (prefer const objects)
export const enum ShapeEnum {
  CIRCLE = 1,
  SQUARE = 2,
  TRIANGLE = 3,
  HEX = 4,
}

// Explicit return types for public functions
function calculateDamage(attacker: Entity, defender: Entity): number {
  // ...
}
```

### 4.2 DOD System Guidelines

```typescript
// GOOD: Pure function, reads/writes stores
static update(dt: number) {
  for (let id = 0; id < MAX_ENTITIES; id++) {
    if ((StateStore.flags[id] & EntityFlags.ACTIVE) === 0) continue;

    const idx = id * 8;
    TransformStore.data[idx] += PhysicsStore.data[idx] * dt;
  }
}

// BAD: Side effects, object mutation
static update(entities: Entity[], dt: number) {
  entities.forEach(e => {
    e.position.x += e.velocity.x * dt;  // Object mutation!
    playSound('move');  // Side effect!
  });
}
```

### 4.3 React Guidelines

```typescript
// Use function components
export function HUD({ player }: { player: Player }) {
  return (
    <div className="hud">
      <HealthBar value={player.health} max={player.maxHealth} />
    </div>
  );
}

// Use hooks for state
export function useGameSession() {
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    return gameStateManager.subscribe(setState);
  }, []);

  return state;
}

// Avoid inline objects in props
// BAD
<Component style={{ color: 'red' }} />  // New object each render!

// GOOD
const style = useMemo(() => ({ color: 'red' }), []);
<Component style={style} />
```

### 4.4 File Naming

| Type | Pattern | Example |
|------|---------|---------|
| React Component | `PascalCase.tsx` | `GameCanvas.tsx` |
| React Hook | `useCamelCase.ts` | `useGameSession.ts` |
| System | `PascalCaseSystem.ts` | `PhysicsSystem.ts` |
| Store | `PascalCaseStore.ts` | `TransformStore.ts` |
| Types | `camelCase.ts` | `cjrTypes.ts` |
| Constants | `UPPER_SNAKE` | `MAX_ENTITIES` |
| Tests | `*.test.ts` | `PhysicsSystem.test.ts` |

---

## 5. Testing

### 5.1 Test Structure

```typescript
// packages/engine/src/__tests__/PhysicsSystem.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { TransformStore, PhysicsStore, resetAllStores } from '../dod/ComponentStores';

describe('PhysicsSystem', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('should integrate velocity to position', () => {
    // Arrange
    const id = 0;
    TransformStore.set(id, 0, 0, 0, 1);
    PhysicsStore.data[id * 8] = 10;  // vx = 10
    PhysicsStore.data[id * 8 + 1] = 5;  // vy = 5

    // Act
    PhysicsSystem.update(1/60);

    // Assert
    expect(TransformStore.data[id * 8]).toBeGreaterThan(0);
  });

  it('should clamp position to map bounds', () => {
    // ...
  });
});
```

### 5.2 Running Tests

```bash
# Run all tests
npm run test

# Run with UI
npm run test -- --ui

# Run specific file
npx vitest run packages/engine/src/__tests__/PhysicsSystem.test.ts

# Run with coverage
npm run test -- --coverage

# Watch mode
npm run test -- --watch
```

### 5.3 Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Unit Tests | `src/__tests__/` | Test individual functions |
| Integration | `tests/integration/` | Test system interactions |
| E2E | `tests/e2e/` | Full user flows (Playwright) |
| Performance | `tests/performance/` | Load testing (Artillery) |

---

## 6. Debugging

### 6.1 Browser DevTools

```typescript
// Access game state in console
window.__DEBUG__ = {
  gameStateManager: gameStateManager,
  engine: optimizedEngine,
};

// In browser console:
__DEBUG__.gameStateManager.getCurrentState()
```

### 6.2 Performance Profiling

```typescript
// Enable performance monitor
import { performanceMonitor } from '@/core/performance/PerformanceMonitor';

performanceMonitor.startMonitoring();

// View stats
console.log(performanceMonitor.getAverageFrameTime());
console.log(performanceMonitor.getMemoryUsage());
```

### 6.3 Network Debugging

```typescript
// Enable Colyseus debug
localStorage.setItem('colyseus:debug', 'true');

// View room state
room.state.listen('players', (change) => {
  console.log('Player change:', change);
});
```

---

## 7. Common Tasks

### 7.1 Add a New Component Store

```typescript
// 1. Define store in ComponentStores.ts
export const MyStore = {
  STRIDE: 4,
  data: new Float32Array(MAX_ENTITIES * 4),

  set(id: number, a: number, b: number, c: number, d: number) {
    const idx = id * 4;
    this.data[idx] = a;
    this.data[idx + 1] = b;
    this.data[idx + 2] = c;
    this.data[idx + 3] = d;
  },

  get(id: number): { a: number; b: number; c: number; d: number } {
    const idx = id * 4;
    return {
      a: this.data[idx],
      b: this.data[idx + 1],
      c: this.data[idx + 2],
      d: this.data[idx + 3],
    };
  },

  reset() {
    this.data.fill(0);
  },
};

// 2. Export from dod/index.ts
export { MyStore } from './ComponentStores';

// 3. Add to resetAllStores()
export function resetAllStores() {
  TransformStore.reset();
  PhysicsStore.reset();
  MyStore.reset();  // Add this
  // ...
}
```

### 7.2 Add a New System

```typescript
// 1. Create system file
// packages/engine/src/systems/MySystem.ts

import { MAX_ENTITIES, EntityFlags } from '../dod/EntityFlags';
import { StateStore, MyStore } from '../dod/ComponentStores';

export class MySystem {
  static update(dt: number) {
    for (let id = 0; id < MAX_ENTITIES; id++) {
      if ((StateStore.flags[id] & EntityFlags.ACTIVE) === 0) continue;

      // Your logic here
    }
  }
}

// 2. Export from systems/index.ts
export { MySystem } from './MySystem';

// 3. Add to engine update loop
// In OptimizedEngine.updateGameState():
MySystem.update(dt);
```

### 7.3 Add a New React Hook

```typescript
// apps/client/src/hooks/useMyHook.ts

import { useState, useEffect, useCallback } from 'react';
import { gameStateManager } from '@/game/engine/GameStateManager';

export function useMyHook() {
  const [data, setData] = useState<MyData | null>(null);

  useEffect(() => {
    // Setup
    const unsubscribe = gameStateManager.subscribe((state) => {
      setData(extractMyData(state));
    });

    // Cleanup
    return unsubscribe;
  }, []);

  const doAction = useCallback(() => {
    // Action logic
  }, []);

  return { data, doAction };
}
```

### 7.4 Add a New Screen

```typescript
// 1. Create screen component
// apps/client/src/components/screens/MyScreen.tsx

import React from 'react';

interface MyScreenProps {
  onNavigate: (screen: string) => void;
}

export function MyScreen({ onNavigate }: MyScreenProps) {
  return (
    <div className="my-screen">
      <h1>My Screen</h1>
      <button onClick={() => onNavigate('menu')}>Back</button>
    </div>
  );
}

// 2. Add to ScreenManager
// In ScreenManager.tsx:
case 'myScreen':
  return <MyScreen onNavigate={setScreen} />;
```

---

## 8. Docker Development

### 8.1 Local Services

```bash
# Start PostgreSQL + Redis
docker-compose up -d postgres redis

# View logs
docker-compose logs -f postgres

# Stop services
docker-compose down
```

### 8.2 Full Stack

```bash
# Build and run all
docker-compose up --build

# Run in background
docker-compose up -d

# View all logs
docker-compose logs -f
```

---

## 9. Troubleshooting

### 9.1 "Cannot find module '@cjr/engine'"

```bash
# Rebuild dependencies
npm install

# If still failing, clear cache
rm -rf node_modules
npm install
```

### 9.2 "Port 5173 already in use"

```bash
# Find process
lsof -i :5173

# Kill it
kill -9 <PID>
```

### 9.3 "TypeScript errors after refactor"

```bash
# Clear TypeScript cache
rm -rf apps/client/dist
rm -rf packages/engine/dist

# Restart TypeScript server in VS Code:
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### 9.4 "Tests failing with 'Cannot find module'"

```bash
# Ensure packages are built
cd packages/engine && npm run build
cd packages/shared && npm run build

# Then run tests
npm run test
```

---

## 10. IDE Setup (VS Code)

### 10.1 Recommended Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "usernamehw.errorlens",
    "GitHub.copilot"
  ]
}
```

### 10.2 Workspace Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### 10.3 Debug Configurations

```json
// .vscode/launch.json
{
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Client",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/apps/client"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/apps/server/src/index.ts",
      "runtimeArgs": ["-r", "tsx/esm"],
      "env": { "NODE_ENV": "development" }
    }
  ]
}
```

---

## 11. Performance Guidelines

### 11.1 Memory Budget

| Metric | Budget | How to Check |
|--------|--------|--------------|
| Frame Time | < 16.67ms | `performance.now()` |
| Memory Delta/Frame | < 1KB | `performance.memory` |
| GC Pauses | 0/minute | DevTools → Performance |

### 11.2 Optimization Tips

```typescript
// AVOID: Object creation in hot paths
for (let i = 0; i < entities.length; i++) {
  const pos = { x: 0, y: 0 };  // BAD: new object each iteration
  // ...
}

// GOOD: Reuse objects
const tempPos = { x: 0, y: 0 };
for (let i = 0; i < entities.length; i++) {
  tempPos.x = 0;
  tempPos.y = 0;
  // ...
}

// AVOID: Array methods in hot paths
entities.filter(e => e.active).map(e => e.position);  // BAD

// GOOD: Use for loops
for (let i = 0; i < entities.length; i++) {
  if (!entities[i].active) continue;
  // process
}

// AVOID: String concatenation in loops
for (const e of entities) {
  console.log(`Entity ${e.id} at ${e.x}, ${e.y}`);  // BAD
}

// GOOD: Disable logging in production
if (DEV_MODE) {
  console.log(...);
}
```

---

**End of Document**
