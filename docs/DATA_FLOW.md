# Color Jelly Rush - Data Flow Architecture

> **Last Updated:** February 2, 2026
> **Purpose:** Visual guide to data flow throughout the system

---

## 1. High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐      ┌──────────────────┐      ┌─────────────────────┐       │
│   │ Keyboard │      │   BufferedInput  │      │   InputStore (DOD)  │       │
│   │  Mouse   │─────►│   Ring Buffer    │─────►│   TypedArray        │       │
│   │  Touch   │      └──────────────────┘      └──────────┬──────────┘       │
│   └──────────┘                                           │                   │
│                                                          ▼                   │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                        GAME LOOP (60 FPS)                            │  │
│   │  ┌─────────────┐   ┌──────────────────┐   ┌────────────────────┐    │  │
│   │  │ GameState   │   │ OptimizedEngine  │   │  DOD Component     │    │  │
│   │  │   Manager   │──►│   .update(dt)    │──►│  Stores (TypedArr) │    │  │
│   │  └─────────────┘   └──────────────────┘   └────────────────────┘    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                       │                                      │
│                    ┌──────────────────┼──────────────────┐                  │
│                    ▼                  ▼                  ▼                  │
│   ┌──────────────────────┐  ┌─────────────────┐  ┌───────────────────┐     │
│   │   React Components   │  │   Pixi.js       │  │   NetworkClient   │     │
│   │   (HUD, Overlays)    │  │   Renderer      │  │   (Colyseus)      │     │
│   └──────────────────────┘  └─────────────────┘  └─────────┬─────────┘     │
│                                                              │               │
└──────────────────────────────────────────────────────────────┼───────────────┘
                                                               │
                                                               ▼
                                                    ┌───────────────────┐
                                                    │   GAME SERVER     │
                                                    │   (Authoritative) │
                                                    └───────────────────┘
```

---

## 2. Game Loop Data Flow

### 2.1 Single-Player Mode

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIXED TIMESTEP GAME LOOP                            │
│                              (60 ticks/sec)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. INPUT PHASE                                                             │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  BufferedInput.syncToStore(playerIndex, worldPos, cameraPos)       │    │
│   │      ↓                                                              │    │
│   │  InputStore.data[idx*4 + 0] = targetX                               │    │
│   │  InputStore.data[idx*4 + 1] = targetY                               │    │
│   │  InputStore.data[idx*4 + 2] = skillInput (0 or 1)                   │    │
│   │  InputStore.data[idx*4 + 3] = reserved                              │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                              ↓                                               │
│   2. PHYSICS UPDATE                                                          │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  OptimizedEngine.updateGameState(state, dt)                         │    │
│   │      ↓                                                              │    │
│   │  PhysicsSystem.update(dt) → TransformStore, PhysicsStore            │    │
│   │  MovementSystem.update(dt) → PhysicsStore (velocity from input)     │    │
│   │  SkillSystem.update(dt) → SkillStore, effects                       │    │
│   │  CJR Systems → colorMath, ringSystem, winCondition                  │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                              ↓                                               │
│   3. SYNC DOD → OBJECTS (for legacy/UI)                                      │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  state.player.position.x = TransformStore.data[playerTIdx]          │    │
│   │  state.player.position.y = TransformStore.data[playerTIdx + 1]      │    │
│   │  state.player.velocity.x = PhysicsStore.data[playerTIdx]            │    │
│   │  state.player.velocity.y = PhysicsStore.data[playerTIdx + 1]        │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                              ↓                                               │
│   4. VFX & AUDIO UPDATE                                                      │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  vfxIntegrationManager.update(state, dt)                            │    │
│   │  audioEngine.setListenerPosition(playerX, playerY)                  │    │
│   │  audioEngine.setBGMIntensity(matchPercent * 4)                      │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                              ↓                                               │
│   5. NOTIFY SUBSCRIBERS                                                      │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  gameStateManager.notifySubscribers()                               │    │
│   │      ↓                                                              │    │
│   │  React re-render (HUD, overlays)                                    │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                              ↓                                               │
│   6. RENDER PHASE (runs at display refresh rate)                             │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  renderCallback(alpha)                                              │    │
│   │      ↓                                                              │    │
│   │  Pixi.js or Canvas2D draw calls                                     │    │
│   │  Interpolation: pos = prev + (curr - prev) * alpha                  │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Multi-Player Mode

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MULTIPLAYER DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   CLIENT                                     SERVER                          │
│   ──────                                     ──────                          │
│                                                                              │
│   ┌─────────────────┐                                                        │
│   │ BufferedInput   │                                                        │
│   │ popEvents()     │                                                        │
│   └────────┬────────┘                                                        │
│            │                                                                 │
│            ▼                                                                 │
│   ┌─────────────────┐         Binary Packet          ┌─────────────────┐    │
│   │ NetworkClient   │ ══════════════════════════════►│ GameRoom        │    │
│   │ .sendInput()    │         (60 msgs/s)            │ onMessage()     │    │
│   └─────────────────┘                                └────────┬────────┘    │
│                                                                │             │
│                                                                ▼             │
│                                                       ┌─────────────────┐    │
│                                                       │ServerEngineBridge│   │
│                                                       │ processInput()  │    │
│                                                       └────────┬────────┘    │
│                                                                │             │
│                                                                ▼             │
│                                                       ┌─────────────────┐    │
│                                                       │ @cjr/engine     │    │
│                                                       │ Engine.update() │    │
│                                                       └────────┬────────┘    │
│                                                                │             │
│                                                                ▼             │
│   ┌─────────────────┐         State Snapshot         ┌─────────────────┐    │
│   │ NetworkClient   │ ◄══════════════════════════════│ GameRoom        │    │
│   │ onStateChange() │         (20 msgs/s)            │ broadcastPatch  │    │
│   └────────┬────────┘                                └─────────────────┘    │
│            │                                                                 │
│            ▼                                                                 │
│   ┌─────────────────┐                                                        │
│   │ Ring Buffer     │ ◄── Store snapshots for interpolation                 │
│   │ Interpolation   │                                                        │
│   └────────┬────────┘                                                        │
│            │                                                                 │
│            ▼                                                                 │
│   ┌─────────────────┐                                                        │
│   │ Client Render   │ ◄── Smooth visual updates                              │
│   └─────────────────┘                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. DOD (Data-Oriented Design) Data Flow

### 3.1 Component Store Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOD COMPONENT STORES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   TransformStore (Float32Array)                                              │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │ STRIDE = 8 floats per entity                                          │ │
│   │                                                                        │ │
│   │  idx*8+0  │  idx*8+1  │  idx*8+2  │  idx*8+3  │  idx*8+4  │  ...     │ │
│   │    x      │    y      │  rotation │   scale   │   prevX   │  prevY   │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│   PhysicsStore (Float32Array)                                                │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │ STRIDE = 8 floats per entity                                          │ │
│   │                                                                        │ │
│   │  idx*8+0  │  idx*8+1  │  idx*8+2  │  idx*8+3  │  idx*8+4  │  ...     │ │
│   │    vx     │    vy     │  angVel   │   mass    │   radius  │  restit  │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│   StateStore (Uint32Array) - Bitmask flags                                   │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │  flags[idx] = ACTIVE | PLAYER | RING_1 | ...                          │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│   StatsStore (Float32Array)                                                  │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │  idx*4+0  │  idx*4+1  │  idx*4+2  │  idx*4+3  │                       │ │
│   │   health  │  maxHealth│   score   │    xp     │                       │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│   InputStore (Float32Array)                                                  │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │  idx*4+0  │  idx*4+1  │  idx*4+2  │  idx*4+3  │                       │ │
│   │  targetX  │  targetY  │ skillFlag │  reserved │                       │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 System Data Access Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM UPDATE FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        MovementSystem                                │   │
│   │                                                                      │   │
│   │   READS:    InputStore (targetX, targetY)                            │   │
│   │             TransformStore (x, y)                                    │   │
│   │                                                                      │   │
│   │   WRITES:   PhysicsStore (vx, vy)                                    │   │
│   │                                                                      │   │
│   │   for (idx = 0; idx < entityCount; idx++) {                          │   │
│   │     targetX = InputStore.data[idx*4 + 0]                             │   │
│   │     targetY = InputStore.data[idx*4 + 1]                             │   │
│   │     currX = TransformStore.data[idx*8 + 0]                           │   │
│   │     currY = TransformStore.data[idx*8 + 1]                           │   │
│   │                                                                      │   │
│   │     dx = targetX - currX                                             │   │
│   │     dy = targetY - currY                                             │   │
│   │     PhysicsStore.data[idx*8 + 0] = dx * speed                        │   │
│   │     PhysicsStore.data[idx*8 + 1] = dy * speed                        │   │
│   │   }                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        PhysicsSystem                                 │   │
│   │                                                                      │   │
│   │   READS:    PhysicsStore (vx, vy)                                    │   │
│   │                                                                      │   │
│   │   WRITES:   TransformStore (x, y, prevX, prevY)                      │   │
│   │                                                                      │   │
│   │   for (idx = 0; idx < entityCount; idx++) {                          │   │
│   │     // Store previous position for interpolation                     │   │
│   │     TransformStore.data[idx*8 + 4] = TransformStore.data[idx*8 + 0]  │   │
│   │     TransformStore.data[idx*8 + 5] = TransformStore.data[idx*8 + 1]  │   │
│   │                                                                      │   │
│   │     // Apply velocity                                                │   │
│   │     TransformStore.data[idx*8 + 0] += PhysicsStore.data[idx*8+0]*dt  │   │
│   │     TransformStore.data[idx*8 + 1] += PhysicsStore.data[idx*8+1]*dt  │   │
│   │   }                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        SkillSystem                                   │   │
│   │                                                                      │   │
│   │   READS:    InputStore (skillFlag)                                   │   │
│   │             SkillStore (cooldowns)                                   │   │
│   │             TransformStore (x, y)                                    │   │
│   │                                                                      │   │
│   │   WRITES:   SkillStore (cooldowns)                                   │   │
│   │             PhysicsStore (for dash velocity)                         │   │
│   │             EventRingBuffer (for VFX triggers)                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Event System Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EVENT RING BUFFER FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   GAME SYSTEMS (Headless Engine)                                             │
│   ──────────────────────────────                                             │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  SkillSystem / CollisionSystem / WaveSpawner                         │   │
│   │                                                                      │   │
│   │  // Emit events into ring buffer (zero allocation)                   │   │
│   │  eventBuffer.push({                                                  │   │
│   │    type: EngineEventType.PARTICLE_BURST,                             │   │
│   │    x: entity.x,                                                      │   │
│   │    y: entity.y,                                                      │   │
│   │    data: { color: 0xFF0000, count: 20 }                              │   │
│   │  });                                                                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     EventRingBuffer                                  │   │
│   │                                                                      │   │
│   │   [slot0] [slot1] [slot2] [slot3] ... [slotN]                        │   │
│   │      ↑                        ↑                                      │   │
│   │    head                      tail                                    │   │
│   │                                                                      │   │
│   │   - Fixed size (e.g., 256 slots)                                     │   │
│   │   - Circular overwrite (oldest events discarded)                     │   │
│   │   - Zero GC allocation                                               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   CLIENT VFX LAYER (runs on client only)                                     │
│   ──────────────────────────────────────                                     │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  vfxIntegrationManager.drainEvents()                                 │   │
│   │                                                                      │   │
│   │  eventBuffer.drain((event) => {                                      │   │
│   │    switch (event.type) {                                             │   │
│   │      case EngineEventType.PARTICLE_BURST:                            │   │
│   │        particleSystem.emit(event.x, event.y, event.data);            │   │
│   │        break;                                                        │   │
│   │      case EngineEventType.SCREEN_SHAKE:                              │   │
│   │        cameraShake.trigger(event.data.intensity);                    │   │
│   │        break;                                                        │   │
│   │      case EngineEventType.PLAY_SOUND:                                │   │
│   │        audioEngine.play(event.data.sfx, event.x, event.y);           │   │
│   │        break;                                                        │   │
│   │    }                                                                 │   │
│   │  });                                                                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. React UI Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REACT UI DATA FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      GameStateManager                                │   │
│   │                                                                      │   │
│   │   currentState: GameState                                            │   │
│   │   subscribers: Set<(state: GameState) => void>                       │   │
│   │   eventListeners: Set<(event: GameEvent) => void>                    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                │                                       │                     │
│                │ notifySubscribers()                   │ emitEvent()         │
│                ▼                                       ▼                     │
│   ┌──────────────────────────┐           ┌──────────────────────────┐       │
│   │    useGameDataBridge     │           │     useGameSession       │       │
│   │                          │           │                          │       │
│   │  const [state, setState] │           │  subscribeEvent(event)   │       │
│   │    = useState<GameState> │           │                          │       │
│   │                          │           │  switch (event.type) {   │       │
│   │  useEffect(() => {       │           │    case 'GAME_OVER':     │       │
│   │    manager.subscribe(    │           │      setScreen('over');  │       │
│   │      setState            │           │    case 'TATTOO_REQUEST':│       │
│   │    );                    │           │      showTattooPicker(); │       │
│   │  }, []);                 │           │  }                       │       │
│   └────────────┬─────────────┘           └──────────────────────────┘       │
│                │                                                             │
│                │ props drilling / context                                    │
│                ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         React Components                             │   │
│   │                                                                      │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │   │
│   │   │     HUD     │  │  Minimap    │  │      Leaderboard            │ │   │
│   │   │             │  │             │  │                             │ │   │
│   │   │ HP: {hp}    │  │ {entities}  │  │ 1. {player1.name}           │ │   │
│   │   │ Match: {%}  │  │             │  │ 2. {player2.name}           │ │   │
│   │   └─────────────┘  └─────────────┘  └─────────────────────────────┘ │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   KEY PRINCIPLE: React components are READ-ONLY observers                    │
│   - Never mutate GameState directly from components                          │
│   - Dispatch actions through GameStateManager methods                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Rendering Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RENDERING PIPELINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   FIXED TICK (60 Hz)                    VARIABLE FRAME (Display Hz)          │
│   ─────────────────                     ─────────────────────────            │
│                                                                              │
│   ┌─────────────────┐                   ┌─────────────────────────────────┐ │
│   │ Physics Update  │                   │         Render Frame            │ │
│   │                 │                   │                                 │ │
│   │ prevPos = curr  │                   │  alpha = accumulator / tickRate │ │
│   │ currPos += vel  │                   │                                 │ │
│   └─────────────────┘                   │  for each entity:               │ │
│           │                             │    renderX = lerp(prevX,        │ │
│           │                             │                 currX, alpha)   │ │
│           ▼                             │    renderY = lerp(prevY,        │ │
│   ┌─────────────────┐                   │                 currY, alpha)   │ │
│   │ TransformStore  │──────────────────►│                                 │ │
│   │                 │                   │    sprite.position.set(         │ │
│   │ [prevX, prevY]  │                   │      renderX, renderY           │ │
│   │ [currX, currY]  │                   │    );                           │ │
│   └─────────────────┘                   │                                 │ │
│                                         │  pixi.renderer.render(stage);   │ │
│                                         └─────────────────────────────────┘ │
│                                                                              │
│   Timeline:                                                                  │
│   ─────────                                                                  │
│                                                                              │
│   Tick 0        Tick 1        Tick 2        Tick 3                           │
│     │             │             │             │                              │
│     ▼             ▼             ▼             ▼                              │
│   ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐                         │
│   │ R │ R │ R │ R │ R │ R │ R │ R │ R │ R │ R │ R │ ← Render frames          │
│   └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘                         │
│                                                                              │
│   60 ticks/sec + 144 renders/sec = smooth visuals                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Network Sync Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NETWORK SYNCHRONIZATION FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   CLIENT A                    SERVER                    CLIENT B             │
│   ────────                    ──────                    ────────             │
│                                                                              │
│   t=0  Input: Move Right                                                     │
│        ┌──────────────┐                                                      │
│        │ sendInput()  │────────►┌──────────────┐                            │
│        │ targetX: 100 │         │ GameRoom     │                            │
│        │ targetY: 50  │         │ onMessage()  │                            │
│        └──────────────┘         └──────┬───────┘                            │
│                                        │                                     │
│   t=16ms                               ▼                                     │
│        Local Prediction         ┌──────────────┐                            │
│        ┌──────────────┐         │ Engine.update│                            │
│        │ x: 101       │         │ (Authoritative)                           │
│        │ y: 50        │         │              │                            │
│        └──────────────┘         │ x: 101       │                            │
│                                 │ y: 50        │                            │
│                                 └──────┬───────┘                            │
│                                        │                                     │
│   t=50ms (RTT)                         │ broadcast                           │
│        ◄───────────────────────────────┼────────────────────────────►       │
│                                        │                                     │
│        ┌──────────────┐         ┌──────┴───────┐        ┌──────────────┐    │
│        │ State Patch  │         │ State:       │        │ State Patch  │    │
│        │              │◄────────│ playerA.x=101│───────►│              │    │
│        │ Reconcile    │         │ playerA.y=50 │        │ Interpolate  │    │
│        └──────────────┘         └──────────────┘        └──────────────┘    │
│                                                                              │
│   Client A: Prediction + Reconciliation                                      │
│   Client B: Interpolation (smooth following)                                 │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     RING BUFFER INTERPOLATION                        │   │
│   │                                                                      │   │
│   │   Buffer: [snap0] [snap1] [snap2] [snap3] ...                        │   │
│   │              ↑               ↑                                       │   │
│   │           older           newer                                      │   │
│   │                                                                      │   │
│   │   Render at t - 100ms (delay for smoothness)                         │   │
│   │   Interpolate between snap1 and snap2                                │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. CJR Game Logic Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CJR MECHANICS DATA FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   PLAYER CONSUMES PIGMENT                                                    │
│   ───────────────────────                                                    │
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│   │ Collision    │────►│ mixPigment() │────►│ Player.pigment│               │
│   │ Detection    │     │              │     │ = newColor    │               │
│   └──────────────┘     │ newPigment = │     └───────┬──────┘                │
│                        │  lerp(old,   │             │                        │
│                        │  food.pigment,│             ▼                        │
│                        │  mixRatio)   │     ┌──────────────┐                │
│                        └──────────────┘     │calcMatchPercent               │
│                                             │ (player, target)│              │
│                                             └───────┬──────┘                │
│                                                     │                        │
│                                                     ▼                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                       RING PROGRESSION                               │   │
│   │                                                                      │   │
│   │   if (matchPercent >= 0.5 && currentRing === 1) {                    │   │
│   │     commitToRing2();                                                 │   │
│   │     applyBonus(shield: 2s, speedBoost: 3s);                          │   │
│   │   }                                                                  │   │
│   │                                                                      │   │
│   │   if (matchPercent >= 0.7 && currentRing === 2) {                    │   │
│   │     commitToRing3();                                                 │   │
│   │     applyBonus(shield: 3s, speedBoost: 4s);                          │   │
│   │   }                                                                  │   │
│   │                                                                      │   │
│   │   ┌─────────┐      ┌─────────┐      ┌─────────┐                      │   │
│   │   │ RING 1  │─────►│ RING 2  │─────►│ RING 3  │───► WIN CONDITION    │   │
│   │   │ Outer   │ 50%  │ Middle  │ 70%  │ Center  │                      │   │
│   │   └─────────┘      └─────────┘      └─────────┘                      │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   WIN CONDITION                                                              │
│   ─────────────                                                              │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │   if (currentRing === 3 && matchPercent >= 0.9) {                    │   │
│   │     holdTimer += dt;                                                 │   │
│   │                                                                      │   │
│   │     // Heartbeat pulse every 0.5s                                    │   │
│   │     if (holdTimer % 0.5 < dt) {                                      │   │
│   │       emitHeartbeatVFX(intensity: holdTimer / 1.5);                  │   │
│   │     }                                                                │   │
│   │                                                                      │   │
│   │     if (holdTimer >= 1.5) {                                          │   │
│   │       VICTORY!                                                       │   │
│   │     }                                                                │   │
│   │   } else {                                                           │   │
│   │     holdTimer = max(0, holdTimer - dt * 0.5); // Partial decay       │   │
│   │   }                                                                  │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Authority Summary

| Data | Authority (SSOT) | Read By | Write By |
|------|------------------|---------|----------|
| Position (x, y) | `TransformStore` | Renderer, Physics, UI | PhysicsSystem |
| Velocity (vx, vy) | `PhysicsStore` | PhysicsSystem | MovementSystem, Skills |
| Health/Score | `StatsStore` | UI, Combat | Combat, Pickup |
| Input Target | `InputStore` | MovementSystem | BufferedInput |
| Entity Flags | `StateStore` | All Systems | Factory, Lifecycle |
| Pigment/Color | `Player.pigment` | ColorMath, Renderer | Eating System |
| Match Percent | Calculated | UI, Ring Logic | (derived) |
| Ring Level | `Player.ring` | Ring Logic, UI | Ring Commit |
| Tattoos | `TattooStore` | TattooSystem | Upgrade System |
| Skill Cooldowns | `SkillStore` | SkillSystem, UI | SkillSystem |

---

**End of Document**
