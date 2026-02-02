# Color Jelly Rush - Systems Overview

> **Last Updated:** February 2, 2026
> **Purpose:** Complete reference for all game systems and their interactions

---

## 1. Systems Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEMS HIERARCHY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      ENGINE SYSTEMS (Pure DOD)                       │   │
│   │                         @cjr/engine                                  │   │
│   │                                                                      │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │   │ MovementSys │  │ PhysicsSys  │  │  SkillSys   │                 │   │
│   │   │             │  │             │  │             │                 │   │
│   │   │ Input→Vel   │  │ Vel→Pos     │  │ Cooldowns   │                 │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                          │
│                                   ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      CJR GAME SYSTEMS                                │   │
│   │                         @cjr/engine/cjr                              │   │
│   │                                                                      │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │   │ ColorMath   │  │ RingSystem  │  │ WaveSpawner │                 │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │   │ TattooSys   │  │  BossCJR    │  │ WinCondition│                 │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                          │
│                                   ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      CLIENT SYSTEMS (VFX/UI)                         │   │
│   │                         apps/client                                  │   │
│   │                                                                      │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │   │ VFXSystem   │  │ AudioEngine │  │ RenderSys   │                 │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Engine Systems

### 2.1 MovementSystem

**Location:** `packages/engine/src/systems/MovementSystem.ts`

**Purpose:** Converts player input into velocity

**Reads:**
- `InputStore` - Target position (targetX, targetY)
- `TransformStore` - Current position (x, y)
- `ConfigStore` - Speed multiplier

**Writes:**
- `PhysicsStore` - Velocity (vx, vy)

**Algorithm:**
```
1. Read target position from InputStore
2. Calculate direction vector: (targetX - x, targetY - y)
3. Apply acceleration toward target
4. Cap velocity at maxSpeed * speedMultiplier
```

**Constants:**
| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_SPEED_BASE` | 150 | Base movement speed |
| `ACCEL` | 2000 | Acceleration rate |
| `DEADZONE` | 1 | Minimum distance to move |

---

### 2.2 PhysicsSystem

**Location:** `packages/engine/src/systems/PhysicsSystem.ts`

**Purpose:** Integrates velocity to update position, applies friction and constraints

**Reads:**
- `PhysicsStore` - Velocity (vx, vy), radius, friction
- `StateStore` - Entity flags (ACTIVE)

**Writes:**
- `TransformStore` - Position (x, y), previous position (prevX, prevY)
- `PhysicsStore` - Velocity after friction

**Algorithm:**
```
1. Apply friction to velocity: v *= friction^timeScale
2. Store previous position for interpolation
3. Integrate position: pos += vel * dt * PHYSICS_TIME_SCALE
4. Apply circular map constraints (bounce off edges)
```

**Constants:**
| Constant | Value | Description |
|----------|-------|-------------|
| `PHY_MAP_RADIUS` | 2500 | Physics boundary radius |
| `FRICTION_BASE` | 0.92 | Default friction coefficient |
| `PHYSICS_TIME_SCALE` | 10 | Velocity scale factor |
| `BOUNCE_FACTOR` | 1.5 | Wall bounce multiplier |

---

### 2.3 SkillSystem

**Location:** `packages/engine/src/systems/SkillSystem.ts`

**Purpose:** Handles skill activation, cooldowns, and execution

**Reads:**
- `SkillStore` - Cooldown, max cooldown, shape ID
- `TransformStore` - Position for skill origin
- `PhysicsStore` - Velocity for directional skills
- `StateStore` - Entity flags

**Writes:**
- `SkillStore` - Cooldown timer
- `PhysicsStore` - Velocity (for dash/pierce skills)
- `EventRingBuffer` - VFX events

**Shape Skills:**

| Shape | Skill Name | Effect | VFX Event |
|-------|------------|--------|-----------|
| Circle (1) | Jet Dash | Boost velocity 800 in movement direction | `PARTICLE_BURST` (Cyan) |
| Square (2) | Shockwave | AOE knockback, radius 150 | `SHOCKWAVE` |
| Triangle (3) | Pierce | Dash 600 toward target | `PARTICLE_BURST` (Orange) |
| Hex (4) | Vortex | Pull nearby entities, radius 200 | `SHOCKWAVE` |

**Cooldown Flow:**
```
1. Player presses skill input
2. Check: cooldown > 0? → Exit
3. Execute skill based on shape
4. Reset cooldown = maxCooldown
5. Each frame: cooldown -= dt
```

---

## 3. CJR Game Systems

### 3.1 ColorMath

**Location:** `packages/engine/src/cjr/colorMath.ts`

**Purpose:** Color mixing and matching calculations

**Key Functions:**

| Function | Description |
|----------|-------------|
| `mixPigment(current, consumed, ratio)` | Blend two pigments based on size ratio |
| `calcMatchPercent(player, target)` | Cosine similarity between pigments (0-1) |
| `getColorHint(player, target)` | Returns hint like "need more red" |
| `getSnapAlpha(matchPercent)` | Returns 0-1 boost factor when match >= 80% |
| `pigmentToInt(pigment)` | Convert RGB pigment to integer |
| `intToHex(color)` | Convert integer to hex string |

**Pigment Structure:**
```typescript
interface Pigment {
  r: number;  // 0-1
  g: number;  // 0-1
  b: number;  // 0-1
}
```

**Match Calculation:**
```
matchPercent = cosine_similarity(player.pigment, target.pigment)
             = (p·t) / (|p| * |t|)
             = dot(p, t) / (magnitude(p) * magnitude(t))
```

---

### 3.2 RingSystem

**Location:** `packages/engine/src/cjr/ringSystem.ts`

**Purpose:** Manage ring progression and commit mechanics

**Key Functions:**

| Function | Description |
|----------|-------------|
| `getRingAtPosition(x, y)` | Returns ring level (1-3) based on distance from center |
| `updateRingLogic(entity, dt)` | Process ring transitions |
| `checkRingTransition(entity)` | Check if entity can commit to next ring |

**Ring Thresholds:**

| Ring | Distance from Center | Match Required to Commit |
|------|---------------------|-------------------------|
| Ring 1 (Outer) | > 1000 | - |
| Ring 2 (Middle) | 500-1000 | 50% |
| Ring 3 (Center) | < 500 | 70% |

**Commit Bonuses:**

| Transition | Shield Duration | Speed Boost Duration |
|------------|----------------|---------------------|
| Ring 1 → 2 | 2s | 3s |
| Ring 2 → 3 | 3s | 4s |

**One-Way Rule:** Entities can only progress inward (1→2→3), never backward.

---

### 3.3 WaveSpawner

**Location:** `packages/engine/src/cjr/waveSpawner.ts`

**Purpose:** Spawn food entities at regular intervals

**Spawn Rates by Ring:**

| Ring | Interval | Spawn Type Distribution |
|------|----------|------------------------|
| Ring 1 | 8s | 60% pigment, 25% neutral, 15% special |
| Ring 2 | 10s | 60% pigment, 25% neutral, 15% special |
| Ring 3 | 12-14s | 60% pigment, 25% neutral, 15% special |

**Dynamic Bounty (Candy Vein):**
- Triggers when Ring 3 population drops below 30%
- Spawns concentrated food cluster at random location
- Helps losing players catch up

**Key Functions:**

| Function | Description |
|----------|-------------|
| `updateWaveSpawner(state, dt)` | Main update loop |
| `resetWaveTimers()` | Reset all spawn timers |
| `spawnFoodAt(x, y, type)` | Create food entity at position |

---

### 3.4 TattooSystem

**Location:** `packages/engine/src/cjr/tattoos.ts`

**Purpose:** Roguelite upgrade system

**12 Tattoo Definitions:**

| ID | Name | Effect | Trigger |
|----|------|--------|---------|
| 1 | Thorn | Reflect 20% damage on hit | `onHit` |
| 2 | Leech | Heal 10% on consume | `onConsume` |
| 3 | Haste | +15% speed | Passive |
| 4 | Bulwark | +20% max HP | Passive |
| 5 | Frenzy | +10% attack speed | Passive |
| 6 | Magnet | +25% pickup range | Passive |
| 7 | Ghost | Phase through on skill | `onSkill` |
| 8 | Nova | Skill emits shockwave | `onSkill` |
| 9 | Regen | Heal 1 HP/s | `onUpdate` |
| 10 | Venom | Apply poison on skill | `onSkill` |
| 11 | Mirror | Copy consumed color | `onConsume` |
| 12 | Anchor | Slower but stronger | Passive |

**Tattoo Triggers:**

| Trigger | When Called |
|---------|-------------|
| `triggerTattooOnSkill(entity)` | When skill is used |
| `triggerTattooOnHit(entity, damage)` | When entity takes damage |
| `triggerTattooOnConsume(entity, food)` | When entity eats food |
| `triggerTattooOnUpdate(entity, dt)` | Every frame |

**Tattoo Choice Flow:**
1. Entity reaches size/XP threshold
2. `getTattooChoices()` returns 3 random tattoos
3. Player picks one
4. `applyTattoo(entity, tattooId)` adds tattoo

---

### 3.5 BossCJR

**Location:** `packages/engine/src/cjr/bossCjr.ts`

**Purpose:** Boss encounter logic

**Boss Phases:**
1. **Idle** - Boss waiting to spawn
2. **Active** - Boss fighting
3. **Enraged** - Boss at low HP, faster attacks
4. **Dead** - Rush window active

**Contribution System:**
- Damage dealt to boss is tracked per player
- Top 8 contributors get tier rewards
- Rewards: XP bonus, tattoo choice, color boost

| Tier | Contribution | Reward |
|------|--------------|--------|
| 1 (MVP) | Top 1 | 100% XP + Tattoo + Color Snap |
| 2 | Top 2-3 | 75% XP + Tattoo |
| 3 | Top 4-6 | 50% XP |
| 4 | Top 7-8 | 25% XP |

**Rush Window:**
- Duration: 5 seconds after boss death
- Effect: Match threshold reduced by 10%
- Purpose: Give players easier progression after boss

---

### 3.6 WinCondition

**Location:** `packages/engine/src/cjr/winCondition.ts`

**Purpose:** Check and handle victory conditions

**Victory Requirements:**
1. Be in Ring 3 (center)
2. Match percent >= 90%
3. Hold for 1.5 seconds

**Heartbeat Mechanic:**
- Every 0.5s while holding, emit heartbeat VFX
- Intensity increases with hold time
- If hit, timer partially resets (not full) for drama

**Algorithm:**
```
if (ring === 3 && matchPercent >= 0.9) {
  holdTimer += dt;

  if (holdTimer % 0.5 < dt) {
    emitHeartbeat(intensity: holdTimer / 1.5);
  }

  if (holdTimer >= 1.5) {
    VICTORY!
  }
} else {
  holdTimer = max(0, holdTimer - dt * 0.5);  // Partial decay
}
```

---

## 4. Client Systems

### 4.1 VFX Integration Manager

**Location:** `apps/client/src/game/vfx/vfxIntegration.ts`

**Purpose:** Bridge between engine events and visual effects

**Event Handling:**
```typescript
eventBuffer.drain((event) => {
  switch (event.type) {
    case EngineEventType.PARTICLE_BURST:
      particleSystem.emit(event.x, event.y, event.color);
      break;
    case EngineEventType.SHOCKWAVE:
      shockwaveRenderer.play(event.x, event.y, event.radius);
      break;
    case EngineEventType.SCREEN_SHAKE:
      camera.shake(event.intensity);
      break;
  }
});
```

---

### 4.2 AudioEngine

**Location:** `apps/client/src/game/audio/AudioEngine.ts`

**Purpose:** Spatial audio and music management

**Key Functions:**

| Function | Description |
|----------|-------------|
| `initialize()` | Setup Web Audio context |
| `play(sfx, x, y)` | Play positional sound |
| `setListenerPosition(x, y)` | Update listener for spatial audio |
| `setBGMIntensity(level)` | Crossfade BGM layers based on gameplay |

**BGM Intensity Levels:**
| Level | Description |
|-------|-------------|
| 0 | Ambient/calm |
| 1 | Light tension |
| 2 | Action |
| 3 | Intense |
| 4 | Boss/climax |

---

### 4.3 Render System

**Location:** `apps/client/src/game/renderer/`

**Purpose:** Abstract rendering backends

**Backends:**

| Backend | When Used |
|---------|-----------|
| `WebGL2Backend` | Default, hardware accelerated |
| `WebGPUBackend` | Future, experimental |
| `Canvas2DBackend` | Fallback for mobile |

**Render Pipeline:**
1. Read positions from `TransformStore`
2. Interpolate: `renderPos = lerp(prevPos, currPos, alpha)`
3. Update sprite positions
4. Draw with Pixi.js/Canvas2D

---

### 4.4 Input System (BufferedInput)

**Location:** `apps/client/src/game/input/BufferedInput.ts`

**Purpose:** Zero-lag input handling with buffering

**Flow:**
```
Keyboard/Mouse/Touch
       ↓
  BufferedInput (Ring Buffer)
       ↓
  syncToStore(playerIndex, worldPos, cameraPos)
       ↓
  InputStore (DOD TypedArray)
       ↓
  MovementSystem reads
```

**Benefits:**
- Input is immediately captured
- Converted to world coordinates
- Written directly to DOD store
- No intermediate objects (zero GC)

---

## 5. System Update Order

```
EACH GAME TICK (60 Hz):
┌─────────────────────────────────────────────────────┐
│                                                      │
│   1. BufferedInput.syncToStore()                     │
│      └─ Write input to InputStore                    │
│                                                      │
│   2. MovementSystem.updateAll(dt)                    │
│      └─ Read InputStore → Write PhysicsStore (vel)   │
│                                                      │
│   3. PhysicsSystem.update(dt)                        │
│      └─ Read PhysicsStore → Write TransformStore     │
│                                                      │
│   4. SkillSystem.update(dt)                          │
│      └─ Update cooldowns, emit events                │
│                                                      │
│   5. CJR Systems:                                    │
│      ├─ updateRingLogic()                            │
│      ├─ updateWaveSpawner()                          │
│      ├─ updateBossLogic()                            │
│      ├─ updateWinCondition()                         │
│      └─ triggerTattooOnUpdate()                      │
│                                                      │
│   6. Collision Detection                             │
│      └─ Handle eating, damage, pickups               │
│                                                      │
│   7. Sync DOD → Object State (for UI)                │
│      └─ player.position = TransformStore[playerIdx]  │
│                                                      │
│   8. VFX/Audio Update (client only)                  │
│      └─ Drain event buffer, update particles         │
│                                                      │
│   9. Notify Subscribers (React UI)                   │
│                                                      │
└─────────────────────────────────────────────────────┘

EACH RENDER FRAME (Display Hz):
┌─────────────────────────────────────────────────────┐
│                                                      │
│   1. Calculate interpolation alpha                   │
│      └─ alpha = accumulator / tickRate               │
│                                                      │
│   2. Interpolate positions                           │
│      └─ renderPos = lerp(prevPos, currPos, alpha)    │
│                                                      │
│   3. Update sprite transforms                        │
│                                                      │
│   4. Render (Pixi.js / Canvas2D)                     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 6. System Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEPENDENCY GRAPH                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   InputStore ────► MovementSystem ────► PhysicsStore                         │
│                                              │                               │
│                                              ▼                               │
│   StateStore ◄─── PhysicsSystem ────► TransformStore                         │
│       │                                      │                               │
│       │                                      ▼                               │
│       └──────► SkillSystem ────► EventRingBuffer                             │
│                    │                         │                               │
│                    ▼                         ▼                               │
│              SkillStore              VFXIntegration (client)                 │
│                    │                                                         │
│                    ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐                │
│   │                  CJR SYSTEMS                            │                │
│   │                                                         │                │
│   │   ColorMath ←───── RingSystem ←───── WinCondition       │                │
│   │       │                │                    │           │                │
│   │       ▼                ▼                    ▼           │                │
│   │   Player.pigment   Player.ring        state.result      │                │
│   │                                                         │                │
│   │   TattooSystem ←─── BossCJR ←─── WaveSpawner            │                │
│   │       │                │               │                │                │
│   │       ▼                ▼               ▼                │                │
│   │   TattooStore    bossState         food[]               │                │
│   │                                                         │                │
│   └────────────────────────────────────────────────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Adding a New System

### Step-by-Step Guide

1. **Create System File:**
```typescript
// packages/engine/src/systems/MyNewSystem.ts

import { StateStore, MyStore } from '../dod/ComponentStores';
import { EntityFlags, MAX_ENTITIES } from '../dod/EntityFlags';

export class MyNewSystem {
  static update(dt: number) {
    const flags = StateStore.flags;

    for (let id = 0; id < MAX_ENTITIES; id++) {
      if ((flags[id] & EntityFlags.ACTIVE) === 0) continue;

      // System logic here
    }
  }
}
```

2. **Export from Index:**
```typescript
// packages/engine/src/systems/index.ts
export { MyNewSystem } from './MyNewSystem';
```

3. **Add to Update Loop:**
```typescript
// In OptimizedEngine.updateGameState()
MyNewSystem.update(dt);
```

4. **If System Needs Store:**
```typescript
// packages/engine/src/dod/ComponentStores.ts
export const MyStore = {
  STRIDE: 4,
  data: new Float32Array(MAX_ENTITIES * 4),
  // ... helper methods
};
```

---

**End of Document**
