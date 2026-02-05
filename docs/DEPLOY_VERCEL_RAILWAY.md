# 🚀 Deployment Guide: Vercel + Railway/Render

## Architecture Overview

```
┌─────────────────┐     WebSocket      ┌─────────────────────┐
│   Vercel        │◄──────────────────►│  Railway / Render   │
│  (Static Site)  │    wss://...       │  (Colyseus Server)  │
│                 │                    │  • Game Rooms       │
│  • React UI     │     HTTP API       │  • WebSocket        │
│  • PixiJS       │◄──────────────────►│  • PostgreSQL       │
│  • Mock Auth    │    /api/*          │  • Redis            │
└─────────────────┘                    └─────────────────────┘
         │                                      │
         │         Serverless Functions         │
         └──────────────────────────────────────┘
                    (Auth, Stats, etc.)
```

---

## 📋 Deployment Steps

### Step 1: Deploy Game Server to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

**Environment Variables in Railway Dashboard:**
```
NODE_ENV=production
PORT=2567
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

**Add PostgreSQL & Redis:**
```bash
railway add --database postgres
railway add --database redis
```

---

### Step 2: Deploy Game Server to Render (Alternative)

1. Push code to GitHub
2. Connect Render to your repo
3. Use `render.yaml` (Blueprint)

**Or manual setup:**
- **Service**: Web Service
- **Runtime**: Docker
- **Dockerfile**: `apps/server/Dockerfile.simple`
- **Port**: 2567

**Environment Variables:**
```
NODE_ENV=production
PORT=2567
CORS_ORIGIN=https://your-vercel-app.vercel.app
JWT_SECRET=your-secret-key
```

---

### Step 3: Deploy Client to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Or deploy to production
vercel --prod
```

**Configure Environment Variables in Vercel Dashboard:**
```
VITE_GAME_SERVER_URL=wss://your-railway-app.up.railway.app
```

---

## 🔧 Configuration Files

### Railway (`railway.json`)
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "apps/server/Dockerfile.simple"
  },
  "deploy": {
    "startCommand": "npm run prod",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Render (`render.yaml`)
```yaml
services:
  - type: web
    name: cjr-game-server
    runtime: docker
    dockerfilePath: ./apps/server/Dockerfile.simple
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "2567"
    healthCheckPath: /health

databases:
  - name: cjr-postgres
    plan: free

redis:
  - name: cjr-redis
    plan: free
```

### Vercel (`vercel.json`)
```json
{
  "version": 2,
  "buildCommand": "cd apps/client && npm run build",
  "outputDirectory": "apps/client/dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" }
  ]
}
```

---

## 💰 Cost Comparison

| Service | Plan | Cost | Notes |
|---------|------|------|-------|
| **Vercel** | Hobby | **Free** | 100GB bandwidth, 10k req/day |
| **Railway** | Starter | **~$5/mo** | $5 credit/month, scales with usage |
| **Render** | Free | **Free** | 750 hours/month, sleeps after 15min idle |
| **PostgreSQL** | Railway/Render Free | **Free** | Included with service |
| **Redis** | Railway/Render Free | **Free** | Included with service |

**Total Monthly Cost: $0 - $5**

---

## ⚠️ Important Notes

### WebSocket Considerations

1. **Railway**: WebSocket works natively, no special config needed
2. **Render Free Tier**: WebSocket works but sleeps after 15min idle (cold start ~30s)
3. **Vercel**: Cannot host WebSocket server (hence the external setup)

### CORS Configuration

Update `CORS_ORIGIN` in your game server to match your Vercel domain:
```
CORS_ORIGIN=https://color-jelly-rush.vercel.app
```

For multiple environments:
```
CORS_ORIGIN=https://color-jelly-rush.vercel.app,https://color-jelly-rush-git-main.vercel.app
```

### Health Check

Game server exposes `/health` endpoint for Railway/Render health checks.

---

## 🔄 Local Development

```bash
# Terminal 1: Start game server
cd apps/server
npm run dev

# Terminal 2: Start client (pointing to local server)
cd apps/client
# Copy env
cp .env.example .env.local
# Edit .env.local: VITE_GAME_SERVER_URL=ws://localhost:2567
npm run dev
```

---

## 🛠️ Troubleshooting

### Connection Failed
```
[NetworkClient] Connection failed
```
**Fix**: Check `VITE_GAME_SERVER_URL` in Vercel env vars matches Railway/Render URL

### CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Fix**: Update `CORS_ORIGIN` in Railway/Render to include your Vercel domain

### WebSocket Disconnects
```
WebSocket connection to 'wss://...' failed
```
**Fix**: 
- Railway: Check if service is running (not suspended)
- Render: Free tier sleeps - wait for cold start or upgrade plan

---

## 📚 Resources

- [Railway Docs](https://docs.railway.app/)
- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Colyseus Deployment](https://docs.colyseus.io/deployment/)
