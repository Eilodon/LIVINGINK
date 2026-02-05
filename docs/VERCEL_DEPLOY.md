# 🚀 Vercel Test Deployment Guide

## Tóm tắt chiến lược

Triển khai bản test đơn giản trên **Vercel** với các infrastructure phức tạp đã được **disable**.

---

## 📊 So sánh Infrastructure

| Component | Production (AWS/Terraform) | Test (Vercel) |
|-----------|---------------------------|---------------|
| **Compute** | EKS Kubernetes | Vercel Serverless Functions |
| **Database** | RDS PostgreSQL | ❌ Mock/In-memory |
| **Cache** | ElastiCache Redis | ❌ Disabled |
| **Auth** | Dedicated auth-service | ✅ Mock endpoints |
| **Game Server** | Colyseus on EKS | ⚠️ Limited support |
| **Monitoring** | Prometheus + Grafana + Jaeger | ❌ Disabled |
| **CDN** | CloudFront | ✅ Vercel Edge |
| **Load Balancer** | AWS ALB | ✅ Vercel Routing |

---

## 🛠️ Các thành phần đã Disable

### 1. Microservices Architecture
```
❌ api-gateway      → ✅ Single Express server
❌ auth-service     → ✅ Mock auth endpoints
❌ user-service     → ✅ Disabled
❌ analytics-service → ✅ Disabled  
❌ notification-service → ✅ Disabled
```

### 2. Data Layer
```
❌ PostgreSQL (RDS) → ❌ No persistent storage
❌ Redis (ElastiCache) → ❌ No session/cache
❌ Migrations → ❌ Not needed
```

### 3. Monitoring & Observability
```
❌ Prometheus - Metrics collection
❌ Grafana - Dashboards
❌ Jaeger - Distributed tracing
❌ CloudWatch - AWS logs
```

### 4. Network Infrastructure
```
❌ VPC + Subnets
❌ NAT Gateways
❌ Security Groups (AWS)
❌ Route 53 DNS
```

---

## ⚡ Cách Deploy

### Bước 1: Install Vercel CLI
```bash
npm i -g vercel
```

### Bước 2: Login và setup
```bash
vercel login
vercel
```

### Bước 3: Environment Variables
Trong Vercel Dashboard, thêm các env vars:
```
NODE_ENV=production
VITE_WS_URL=wss://your-websocket-server.com  # Nếu có server WebSocket riêng
```

---

## 🔄 WebSocket Strategy

**Vấn đề:** Vercel Serverless Functions **không hỗ trợ WebSocket** cho game real-time.

**Giải pháp:**

### Option A: No WebSocket (Static Demo Only)
- Chỉ deploy client
- Không có multiplayer
- Dùng cho UI testing

### Option B: Separate WebSocket Server
```
Vercel (Static + API) ───► External Colyseus Server
         │                        (Railway/Render/Fly.io)
         │
    Static Assets              WebSocket Game Rooms
```

### Option C: Serverless-friendly Game Mode
- Dùng HTTP polling thay WebSocket
- Turn-based gameplay
- Phù hợp cho prototype đơn giản

---

## 📁 Cấu trúc Files

```
COLOR-JELLY-RUSH/
├── vercel.json          # Vercel configuration
├── api/
│   ├── index.ts         # Serverless API entry
│   └── package.json     # API dependencies
├── apps/client/         # Frontend (deployed to Vercel)
└── infrastructure/      # Terraform (disabled for test)
```

---

## 🔧 Chi tiết kỹ thuật

### API Mock Endpoints

| Endpoint | Production | Test (Vercel) |
|----------|------------|---------------|
| `POST /auth/login` | JWT + DB query | Mock token |
| `POST /auth/register` | DB insert | Mock user |
| `GET /health` | Full health check | Basic check |
| `GET /rooms` | Query Redis | Empty array |

### Client Config

```typescript
// apps/client/src/config.ts
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:2567';

// Vercel env sẽ override
```

---

## 💰 Chi phí so sánh

| Service | Production (AWS) | Test (Vercel) |
|---------|-----------------|---------------|
| Compute | ~$200-500/tháng | **Free** (10k req/day) |
| Database | ~$50-100/tháng | **$0** (mock) |
| Cache | ~$20-50/tháng | **$0** (disabled) |
| CDN | ~$20-50/tháng | **Free** (100GB) |
| **Tổng** | **~$300-700/tháng** | **$0** |

---

## ⚠️ Limitations

### Không thể làm:
- ❌ Real-time multiplayer (WebSocket)
- ❌ Persistent data (login giữa sessions)
- ❌ Leaderboards/Stats
- ❌ Matchmaking phức tạp

### Có thể làm:
- ✅ Test UI/UX
- ✅ Demo gameplay đơn player
- ✅ Test phần render (PixiJS)
- ✅ CI/CD pipeline validation

---

## 🚀 Deploy Commands

```bash
# Development
vercel dev

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs
```

---

## 📚 Resources

- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Colyseus Deployment Guide](https://docs.colyseus.io/deployment/)
- [Railway.app](https://railway.app) - Free WebSocket hosting alternative
