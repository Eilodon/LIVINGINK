# COLOR-JELLY-RUSH

**COLOR-JELLY-RUSH** is a high-octane .io web game where you play as a Jelly striving to reach the core of the Centrifuge.

## Features

- **3-Ring World**: Commit to inner rings by matching your color to the core.
- **Physics**: Soft-body simulation with inertia and drag.
- **Classes**: 4 Shapes (Circle, Square, Triangle, Hex) with unique skills.
- **Tattoos**: Evolve your Jelly with 12 unique buffs.
- **Multiplayer**: Powered by Colyseus & PixiJS.

## Controls

- **Mouse/Touch**: Move
- **Space**: Skill (Dash/Bump/Pierce/Magnet)
- **W**: Eject Mass

# Color Jelly Rush - Documentation Hub

> **Version:** 1.0.0-beta.1
> **Last Updated:** February 2, 2026

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Development Guide](./DEVELOPMENT_GUIDE.md) | Setup, conventions, workflows |
| [Project Structure](./PROJECT_STRUCTURE.md) | Folder organization |
| [Module Map](./MODULE_MAP.md) | Package dependencies |
| [Data Flow](./DATA_FLOW.md) | How data moves through the system |
| [Import Reference](./IMPORT_REFERENCE.md) | Correct import paths |
| [Systems Overview](./SYSTEMS_OVERVIEW.md) | Game systems explained |
| [Architecture](./cjr_architecture.md) | Core architecture principles |
| [Tooling Architecture](./TOOLING_ARCHITECTURE.md) | Dev tools design (Editor, Inspector, Viewer) |

---

## Documentation Map

```
docs/
├── README.md                    # You are here
│
├── GETTING STARTED
│   └── DEVELOPMENT_GUIDE.md     # Setup, commands, workflows
│
├── ARCHITECTURE
│   ├── cjr_architecture.md      # Core principles (SSOT, DOD)
│   ├── PROJECT_STRUCTURE.md     # Folder structure
│   ├── MODULE_MAP.md            # Package dependencies
│   └── DATA_FLOW.md             # Data flow diagrams
│
├── REFERENCE
│   ├── IMPORT_REFERENCE.md      # Import paths guide
│   └── SYSTEMS_OVERVIEW.md      # All systems documented
│
├── TOOLING
│   └── TOOLING_ARCHITECTURE.md  # Dev tools design & implementation
│
└── GAME DESIGN
    ├── COLOR-JELLY-RUSH.txt     # Game design document (Vietnamese)
    ├── VISUAL_BIBLE.md          # Visual style guide
    ├── EMOTIONAL_IMPACT_PLAN.md # Player experience design
    └── INNOVATION_PLAN.md       # Future features
```

---

## For New Developers

1. **Start Here:** [Development Guide](./DEVELOPMENT_GUIDE.md)
   - Setup your environment
   - Learn the commands
   - Understand conventions

2. **Understand Structure:** [Project Structure](./PROJECT_STRUCTURE.md)
   - Where files go
   - Module organization
   - Naming conventions

3. **Learn Imports:** [Import Reference](./IMPORT_REFERENCE.md)
   - Correct import paths
   - Package aliases
   - Common mistakes

4. **Understand Systems:** [Systems Overview](./SYSTEMS_OVERVIEW.md)
   - How game systems work
   - System interactions
   - Adding new systems

---

## For Architects

1. **Core Principles:** [Architecture](./cjr_architecture.md)
   - SSOT (Single Source of Truth)
   - DOD (Data-Oriented Design)
   - Fail-fast philosophy

2. **Module Dependencies:** [Module Map](./MODULE_MAP.md)
   - Package relationships
   - Dependency rules
   - Circular dependency prevention

3. **Data Flow:** [Data Flow](./DATA_FLOW.md)
   - Input → Engine → Render
   - DOD store layouts
   - Event system

---

## Quick Reference

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Pixi.js 8, Vite 6 |
| Backend | Express, Colyseus 0.15 |
| Engine | TypeScript 5.8, DOD Pattern |
| Database | PostgreSQL 15, Redis 7 |
| Testing | Vitest, Playwright |
| Deploy | Docker, Kubernetes, Terraform |

### Key Concepts

| Concept | Description |
|---------|-------------|
| **DOD** | Data-Oriented Design - TypedArrays for game state |
| **SSOT** | Single Source of Truth - one authority per data |
| **ECS-like** | Entity ID + Component Stores (not traditional ECS) |
| **Fixed Timestep** | 60 Hz physics, variable render rate |
| **Event Buffer** | Zero-allocation event queue for VFX |

### Important Files

| File | Purpose |
|------|---------|
| `packages/engine/src/index.ts` | Engine public API |
| `packages/shared/src/index.ts` | Shared types/constants |
| `apps/client/src/game/engine/GameStateManager.ts` | Session orchestrator |
| `apps/client/vite.config.ts` | Build configuration |
| `apps/server/src/rooms/GameRoom.ts` | Multiplayer room |

---

## Document Status

| Document | Status | Last Review |
|----------|--------|-------------|
| Development Guide | Current | Feb 2026 |
| Project Structure | Current | Feb 2026 |
| Module Map | Current | Feb 2026 |
| Data Flow | Current | Feb 2026 |
| Import Reference | Current | Feb 2026 |
| Systems Overview | Current | Feb 2026 |
| Tooling Architecture | Current | Feb 2026 |
| Architecture | Current | Jan 2026 |
| Visual Bible | Needs Update | - |
| Innovation Plan | Draft | - |

---

## Contributing to Docs

1. **Update existing docs** when code changes
2. **Create ADRs** for architecture decisions
3. **Add diagrams** using ASCII art (for git compatibility)
4. **Keep examples** up-to-date with current API

### ADR Template

```markdown
# ADR-XXX: Title

## Status
Proposed | Accepted | Deprecated

## Context
What problem are we solving?

## Decision
What did we decide?

## Consequences
What are the trade-offs?
```

---

## Need Help?

- **Code questions:** Check [Systems Overview](./SYSTEMS_OVERVIEW.md)
- **Import errors:** Check [Import Reference](./IMPORT_REFERENCE.md)
- **Architecture decisions:** Check [Architecture](./cjr_architecture.md)
- **Game design:** Check [COLOR-JELLY-RUSH.txt](./COLOR-JELLY-RUSH.txt)

---

**Color Jelly Rush** - A multiplayer .io game with color-matching mechanics
