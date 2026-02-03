# Color Jelly Rush - Dev Tools

This directory contains developer tools for Color Jelly Rush.

## Level Editor

A web-based editor for modifying level configurations with real-time preview and hot-reload.

### Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│  Level Editor   │◄──────────────────►│  Config Server  │
│    UI (5174)    │                    │    (8090/8091)  │
└─────────────────┘                    └────────┬────────┘
                                                │
                                       ┌────────┴────────┐
                                       │  Level JSONs    │
                                       │  (/data/levels) │
                                       └─────────────────┘
```

### Quick Start

```bash
# Terminal 1: Start Config Server
cd tools/level-editor/server
npm run dev

# Terminal 2: Start Editor UI
cd tools/level-editor/ui
npm run dev

# Both client and server auto-connect to Config Server for hot reload
```

### Features

- **Visual Editor**: Edit all level properties with validation
- **Visual Preview**: Canvas-based ring visualization
- **Real-time Sync**: Changes sync via WebSocket
- **Hot Reload**: Game client/server auto-update when levels change
- **Export**: Export all levels as JSON

### API Endpoints

- `GET /api/levels` - List all levels
- `GET /api/levels/:id` - Get specific level
- `PUT /api/levels/:id` - Update level (triggers hot reload)
- `POST /api/levels/export` - Export all levels

## State Viewer (Coming Soon)

Real-time game state inspection and debugging.

## Packet Inspector (Coming Soon)

Network traffic monitoring and analysis.

---

**Security Note**: These tools are for development only and should NOT be enabled in production builds.
