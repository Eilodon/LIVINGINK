import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', env: 'vercel-test' });
});

// Mock auth endpoints (no real DB)
app.post('/auth/login', (req: Request, res: Response) => {
  res.json({ 
    token: 'mock-token-' + Date.now(),
    user: { id: 'user-1', name: 'Test User' }
  });
});

app.post('/auth/register', (req: Request, res: Response) => {
  res.json({ 
    token: 'mock-token-' + Date.now(),
    user: { id: 'user-' + Date.now(), name: req.body.username || 'New User' }
  });
});

// Game rooms stats
app.get('/rooms', (req: Request, res: Response) => {
  res.json({ rooms: [], count: 0 });
});

// For Vercel serverless - export the handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // If it's a WebSocket upgrade request
  if (req.headers.upgrade === 'websocket') {
    res.status(426).json({ 
      error: 'WebSocket connections should use ws:// or wss:// protocol directly'
    });
    return;
  }
  
  // Otherwise use Express
  return app(req, res);
}
