# NGŨ HÀNH MATCH-3 V2.0 - LIVING DOCUMENT
## Wu Xing Elements Puzzle - SOTA 2026 Edition (TypeScript/PixiJS)

---

## 🟢 CURRENT STATUS (Feb 2026)
**Tech Stack:** TypeScript, PixiJS, @cjr/engine (ECS/DOD), Node.js (Guardian Server).
**Completion:** ~30% (Core Mechanics Implemented)

| Feature | Status | Implementation Details |
| :--- | :--- | :--- |
| **Grid System** | ✅ DONE | `GridSystem.ts` (ECS), 5 Elements, Gravity, Matching. |
| **Cycle Logic** | ✅ DONE | `CycleSystem.ts` handles Sinh/Khắc logic. |
| **Boss System** | ✅ DONE | `BossSystem.ts` handles States (Idle/Attack) & Skills (Ash/Stone/Lock). |
| **Subconscious UI** | ✅ DONE | `PredictionSystem.ts` + `GameHost.onPreviewInteraction` (Visual Tints). |
| **Art/VFX** | 🚧 MVP | Using Procedural Graphics (Shapes/Colors). Needs Sprite implementation. |
| **Backend** | 🚧 WIP | `server-guardian` set up. Anti-Cheat & Sync pending. |

---

## PART 1: CORE MECHANICS (Implemented)

### 1.1 The Subconscious UI Revolution
**Philosophy:** "The player should never have to think. The game should think for them."

#### Visual Language System (Implemented Logic)
*   **Metal (Kim):** Circle/Grey (Placeholder) → Target: Silver Diamonds.
*   **Wood (Mộc):** Rect/Green (Placeholder) → Target: Jade Circles.
*   **Water (Thủy):** RoundRect/Blue (Placeholder) → Target: Flowing Waves.
*   **Fire (Hỏa):** Triangle/Red (Placeholder) → Target: Flickering Flames.
*   **Earth (Thổ):** Diamond/Brown (Placeholder) → Target: Stable Squares.

#### Instant Visual Feedback (Codebase: `PredictionSystem.ts`)
When player hovers/drags a tile:

```typescript
// Actual Implementation in PredictionSystem.ts
predict(world: WorldState, grid: GridSystem, cycle: CycleSystem, id: number): PredictionResult {
    // ... logic to check interactions ...
    if (cycle.isDestruction(typeA, typeB)) {
        return { type: InteractionType.DESTRUCTION, affected: [idB] }; // Red Tint
    }
    if (cycle.isGeneration(typeA, typeB)) {
        return { type: InteractionType.GENERATION, affected: [idB] }; // Green Tint
    }
    return { type: InteractionType.NEUTRAL, affected: [] };
}
```

**Result:**
*   **Red Tint:** Destruction (Strong vs Weak).
*   **Green Tint:** Generation (Buff/Feed).
*   **Grey Tint:** Blocked (Ash/Stone).

### 1.2 Elemental Cycle System (Implemented)
**Logic:** `CycleSystem` tracks matches against the Wu Xing cycle (Water → Wood → Fire → Earth → Metal).

*   **Combo Chains:** Sequential matches increase multiplier (2x, 3x...).
*   **Avatar State (Planned):** 5-element chain trigger. currently tracks `cycleIndex` but lacks the "Massive Board Clear" payoff.

### 1.3 Context-Based Effects
**Current Support:**
*   **Ash (Dead Tile):** Blocked, cannot match. Cleansed by adjacent Water match.
*   **Stone (Obstacle):** Blocks gravity. Broken by adjacent Wood match.
*   **Lock (Cage):** Prevents swapping. Broken by Metal match.

---

## PART 2: TECHNICAL ARCHITECTURE (Actual Stack)

### 2.1 ECS / Data-Oriented Design
**Engine:** `@cjr/engine` (Custom ECS)
**State:** `WorldState` (Binary Structs, SharedArrayBuffer compliant).

```typescript
// Component Access Example
const x = TransformAccess.getX(world, entityId);
const flags = StateAccess.getFlags(world, entityId);

if (flags & EntityFlags.DEAD) {
    // Skip dead entities
}
```

### 2.2 Anti-Cheat: Deterministic Replay (Planned)
**Server:** `apps/server-guardian` (Node.js/TypeScript)

**Proposed Implementation:**
1.  **Client:** Record inputs (`Move { form: [r1,c1], to: [r2,c2], time: t }`) + Initial Seed.
2.  **Server:** Re-run `GridSystem` simulation using the same Seed.
3.  **Validation:** Compare Final Score & Board State.

```typescript
// Server-Side Validation (Concept)
function validateLevel(session: GameSession) {
    const serverWorld = new WorldState();
    const grid = new GridSystem(8, 8, session.seed);
    
    for (const move of session.moves) {
        grid.trySwap(serverWorld, move.from, move.to);
        grid.resolveMatches(serverWorld);
    }
    
    if (grid.score !== session.claimedScore) {
         throw new Error("Cheating Detected!");
    }
}
```

---

## PART 3: ART DIRECTION (Phase 1 vs Phase 2)

### 3.1 Phase 1: Animated Watercolor (Target)
**Current:** Procedural Graphics (`Graphics.drawCircle`, etc.) in `GameHost.ts`.
**Goal:** Replace `Graphics` with `Sprite` assets.
*   **Tech:** PixiJS Sprites + Shaders.
*   **Assets needed:** 5 Element Icons, Ash Sprite, Stone Sprite, Lock Sprite.

### 3.2 Phase 2: Living Ink (Future)
*   **Tech:** Custom WebGL Shaders / PixiJS Filters.
*   **Effect:** Ink bleeding simulation on background canvas.

---

## PART 4: INTERACTIVE BOSS DESIGN (Implemented)

### 4.1 Boss Logic (`BossSystem.ts`)
**Bosses are Entities** within the ECS world. They interact with the grid via `BossSkill`.

### 4.2 Implemented Bosses

#### Boss 1: Fire Phoenix (火鳳凰)
*   **Skill:** `Ash Spread` (Every 3 moves).
*   **Effect:** Turns 3 random tiles into **ASH**.
*   **Counter:** Match Water adjacent to Ash to cleanse.

#### Boss 2: Earth Golem (土魔)
*   **Skill:** `Stone Wall` (Every 4 moves).
*   **Effect:** Spawns **STONE** blocks that gravity cannot pass.
*   **Counter:** Match Wood adjacent to Stone to break.

#### Boss 3: Metal Dragon (金龍)
*   **Skill:** `Metal Lock`.
*   **Effect:** Locks specific tiles in place.
*   **Counter:** Match Metal to unlock.

---

## PART 5: DEVELOPMENT ROADMAP (Revised)

### ✅ Month 1: Core Systems (Completed)
*   Match-3 Engine (ECS).
*   Wu Xing Logic (CycleSystem).
*   Basic Boss AI.
*   Subconscious UI (Prediction).

### 🚧 Month 2: Visual Polish (Current Focus)
*   **Art:** Replace procedural shapes with Sprites.
*   **VFX:** Add Particle Systems (Pixi Particles) for matches/skills.
*   **UI:** Boss HP Bar, Ash Meter, Win/Loss Screens.

### 📅 Month 3: Content & Backend
*   **Levels:** Design 50 levels (patterns of Ash/Stone).
*   **Server:** Implement Replay Validation.
*   **Meta:** Basic Progression (Level Unlock).

### 📅 Month 4: Monetization (Future)
*   Battle Pass (Seasons).
*   Skins (Visual Overrides).

---

## CONCLUSION
This document represents the lived reality of the codebase as of **Feb 13, 2026**.
We have moved from "Theoretical Design" to "Functional Prototype". 
The next immediate step is **Visual Juice** (Art Phase 1).
