import express from 'express';
import cors from 'cors';
import * as WebSocket from 'ws';
import chokidar from 'chokidar';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateLevelConfig, type LevelConfig } from './validation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../../data/levels');
const PORT = process.env.PORT || 8090;
const WS_PORT = process.env.WS_PORT || 8091;

const app = express();
app.use(cors());
app.use(express.json());

// Store connected WebSocket clients
const clients = new Set<WebSocket>();

// Broadcast to all connected clients
function broadcast(message: object) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Load all levels
async function loadAllLevels(): Promise<LevelConfig[]> {
  try {
    const files = await readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const levels: LevelConfig[] = [];

    for (const file of jsonFiles) {
      const content = await readFile(join(DATA_DIR, file), 'utf-8');
      const level = JSON.parse(content);
      levels.push(level);
    }

    return levels.sort((a, b) => a.id - b.id);
  } catch (error) {
    console.error('Error loading levels:', error);
    return [];
  }
}

// Load single level
async function loadLevel(id: number): Promise<LevelConfig | null> {
  try {
    const content = await readFile(join(DATA_DIR, `level_${id}.json`), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Save level
async function saveLevel(level: LevelConfig): Promise<void> {
  await writeFile(
    join(DATA_DIR, `level_${level.id}.json`),
    JSON.stringify(level, null, 2)
  );
}

// REST API Routes
app.get('/api/levels', async (req, res) => {
  const levels = await loadAllLevels();
  res.json(levels);
});

app.get('/api/levels/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const level = await loadLevel(id);
  
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }
  
  res.json(level);
});

app.put('/api/levels/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const data = req.body;
  
  // Ensure ID matches
  data.id = id;
  
  const validation = validateLevelConfig(data);
  if (!validation.success) {
    return res.status(400).json({ errors: validation.errors });
  }
  
  await saveLevel(validation.data!);
  
  // Broadcast change to all clients
  broadcast({ 
    type: 'LEVEL_UPDATED', 
    levelId: id,
    level: validation.data 
  });
  
  res.json({ success: true, level: validation.data });
});

app.post('/api/levels/:id/validate', async (req, res) => {
  const id = parseInt(req.params.id);
  const data = req.body;
  data.id = id;
  
  const validation = validateLevelConfig(data);
  res.json(validation);
});

app.post('/api/levels/export', async (req, res) => {
  const levels = await loadAllLevels();
  res.json({ levels, exportedAt: new Date().toISOString() });
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`📊 Config Server running on http://localhost:${PORT}`);
});

// Start WebSocket server
const wss = new WebSocket.WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws: WebSocket.WebSocket) => {
  console.log('🔌 WebSocket client connected');
  clients.add(ws);
  
  // Send current levels to new client
  loadAllLevels().then(levels => {
    ws.send(JSON.stringify({ type: 'INITIAL_STATE', levels }));
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    clients.delete(ws);
  });
});

console.log(`🔌 WebSocket Server running on ws://localhost:${WS_PORT}`);

// File watcher for external edits
const watcher = chokidar.watch(join(DATA_DIR, '*.json'));

watcher.on('change', async (path) => {
  const match = path.match(/level_(\d+)\.json$/);
  if (match) {
    const levelId = parseInt(match[1]);
    console.log(`📝 File changed: level_${levelId}.json`);
    
    const level = await loadLevel(levelId);
    if (level) {
      broadcast({ 
        type: 'LEVEL_UPDATED', 
        levelId,
        level 
      });
    }
  }
});

console.log(`👁️  Watching ${DATA_DIR} for changes`);
