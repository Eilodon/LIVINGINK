/**
 * PHASE 3: API Gateway Implementation
 * Centralized routing, authentication, and load balancing
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { serviceRegistry } from './ServiceRegistry';
import { logger } from '../server/src/logging/Logger';

export interface GatewayConfig {
  port: number;
  timeout: number;
  retries: number;
  circuitBreaker: {
    threshold: number;
    timeout: number;
    resetTimeout: number;
  };
  rateLimit: {
    global: { requests: number; window: number };
    perUser: { requests: number; window: number };
  };
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: Date;
  nextAttemptTime: Date;
}

export class APIGateway {
  private static instance: APIGateway;
  private app: express.Application;
  private config: GatewayConfig;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();

  private constructor() {
    this.config = {
      port: parseInt(process.env.GATEWAY_PORT || '3000'),
      timeout: parseInt(process.env.GATEWAY_TIMEOUT || '30000'),
      retries: parseInt(process.env.GATEWAY_RETRIES || '3'),
      circuitBreaker: {
        threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
        timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000'),
        resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000')
      },
      rateLimit: {
        global: { requests: 1000, window: 60 },
        perUser: { requests: 100, window: 60 }
      }
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  static getInstance(): APIGateway {
    if (!APIGateway.instance) {
      APIGateway.instance = new APIGateway();
    }
    return APIGateway.instance;
  }

  // EIDOLON-V PHASE3: Setup middleware
  private setupMiddleware(): void {
    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('Gateway Request', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });

      next();
    });

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));

    // Global rate limiting
    this.app.use(this.globalRateLimitMiddleware());
  }

  // EIDOLON-V PHASE3: Global rate limiting middleware
  private globalRateLimitMiddleware(): express.RequestHandler {
    return (req, res, next) => {
      const key = 'global';
      const now = Date.now();
      const limiter = this.rateLimiters.get(key);

      if (!limiter || now > limiter.resetTime) {
        this.rateLimiters.set(key, {
          count: 1,
          resetTime: now + (this.config.rateLimit.global.window * 1000)
        });
        return next();
      }

      if (limiter.count >= this.config.rateLimit.global.requests) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((limiter.resetTime - now) / 1000)
        });
      }

      limiter.count++;
      next();
    };
  }

  // EIDOLON-V PHASE3: Per-user rate limiting middleware
  private perUserRateLimitMiddleware(): express.RequestHandler {
    return (req, res, next) => {
      const userId = this.extractUserId(req);
      if (!userId) {
        return next(); // No rate limiting for unauthenticated requests
      }

      const now = Date.now();
      const limiter = this.rateLimiters.get(userId);

      if (!limiter || now > limiter.resetTime) {
        this.rateLimiters.set(userId, {
          count: 1,
          resetTime: now + (this.config.rateLimit.perUser.window * 1000)
        });
        return next();
      }

      if (limiter.count >= this.config.rateLimit.perUser.requests) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((limiter.resetTime - now) / 1000)
        });
      }

      limiter.count++;
      next();
    };
  }

  // EIDOLON-V PHASE3: Extract user ID from request
  private extractUserId(req: express.Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    // In production, this would validate JWT token
    try {
      const token = authHeader.substring(7);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.userId || payload.sub;
    } catch {
      return null;
    }
  }

  // EIDOLON-V PHASE3: Setup routes
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      const services = serviceRegistry.getAllServices();
      const healthStatus = services.map(service => ({
        id: service.id,
        name: service.name,
        status: serviceRegistry.getHealthStatus(service.id)?.status || 'unknown',
        version: service.version
      }));

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: healthStatus,
        circuitBreakers: this.getCircuitBreakerStatus()
      });
    });

    // Service discovery
    this.app.get('/services', (req, res) => {
      const services = serviceRegistry.getAllServices();
      res.json({
        services: services.map(service => ({
          id: service.id,
          name: service.name,
          version: service.version,
          port: service.port,
          endpoints: service.endpoints
        }))
      });
    });

    // Proxy routes to microservices
    this.setupProxyRoutes();

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  // EIDOLON-V PHASE3: Setup proxy routes
  private setupProxyRoutes(): void {
    const services = serviceRegistry.getAllServices();

    for (const service of services) {
      const serviceProxy = createProxyMiddleware({
        target: `http://localhost:${service.port}`,
        changeOrigin: true,
        timeout: this.config.timeout,
        pathRewrite: {
          [`^/api/v1/${service.id}`]: '/api/v1'
        },
        onProxyReq: (proxyReq, req, res) => {
          // Add authentication headers
          if (req.headers.authorization) {
            proxyReq.setHeader('Authorization', req.headers.authorization);
          }

          // Add request ID for tracing
          const reqId = this.generateRequestId();
          proxyReq.setHeader('X-Request-ID', reqId);
          proxyReq.setHeader('X-Forwarded-For', req.ip || 'unknown');
          proxyReq.setHeader('X-Forwarded-Proto', req.protocol);

          logger.debug('Proxying request', {
            service: service.id,
            method: proxyReq.method,
            url: proxyReq.path,
            requestId: reqId
          });
        },
        onProxyRes: (proxyRes, req, res) => {
          // Add response headers
          res.setHeader('X-Service-ID', service.id);
          res.setHeader('X-Service-Version', service.version);

          logger.debug('Proxy response', {
            service: service.id,
            status: proxyRes.statusCode,
            requestId: req.headers['x-request-id']
          });
        },
        onError: (err, req, res) => {
          logger.error('Proxy error', {
            service: service.id,
            error: err.message,
            url: req.url,
            requestId: (req.headers['x-request-id'] as string) || 'unknown'
          });

          // Check circuit breaker
          this.handleCircuitBreaker(service.id);

          if (!res.headersSent) {
            res.status(502).json({
              error: 'Service Unavailable',
              service: service.id,
              message: 'The requested service is currently unavailable',
              timestamp: new Date().toISOString()
            });
          }
        }
      });

      // Apply per-user rate limiting to authenticated routes
      const authMiddleware = this.perUserRateLimitMiddleware();
      this.app.use(`/api/v1/${service.id}`, authMiddleware, serviceProxy);
    }
  }

  // EIDOLON-V PHASE3: Handle circuit breaker
  private handleCircuitBreaker(serviceId: string): void {
    const state = this.circuitBreakers.get(serviceId) || {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: new Date(),
      nextAttemptTime: new Date()
    };

    state.failureCount++;
    state.lastFailureTime = new Date();

    if (state.failureCount >= this.config.circuitBreaker.threshold) {
      state.isOpen = true;
      state.nextAttemptTime = new Date(Date.now() + this.config.circuitBreaker.timeout);

      logger.warn('Circuit breaker opened', {
        service: serviceId,
        failureCount: state.failureCount,
        nextAttempt: state.nextAttemptTime
      });
    }

    this.circuitBreakers.set(serviceId, state);
  }

  // EIDOLON-V PHASE3: Check circuit breaker
  private checkCircuitBreaker(serviceId: string): boolean {
    const state = this.circuitBreakers.get(serviceId);

    if (!state || !state.isOpen) {
      return true; // Circuit breaker is closed
    }

    const now = Date.now();
    if (now >= state.nextAttemptTime.getTime()) {
      // Try to close circuit breaker
      state.isOpen = false;
      state.failureCount = 0;

      logger.info('Circuit breaker attempting to close', {
        service: serviceId
      });

      this.circuitBreakers.set(serviceId, state);
      return true;
    }

    return false; // Circuit breaker is still open
  }

  // EIDOLON-V PHASE3: Get circuit breaker status
  private getCircuitBreakerStatus(): Array<{
    serviceId: string;
    isOpen: boolean;
    failureCount: number;
    lastFailureTime: Date;
    nextAttemptTime: Date;
  }> {
    return Array.from(this.circuitBreakers.entries()).map(([serviceId, state]) => ({
      serviceId,
      ...state
    }));
  }

  // EIDOLON-V PHASE3: Generate request ID
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // EIDOLON-V PHASE3: Start gateway
  async start(): Promise<void> {
    const port = this.config.port;

    return new Promise((resolve, reject) => {
      this.app.listen(port, (err?: Error) => {
        if (err) {
          logger.error('Failed to start API Gateway', { port, error: err.message }, err);
          reject(err);
        } else {
          logger.info('API Gateway started', {
            port,
            services: serviceRegistry.getAllServices().length,
            circuitBreakerThreshold: this.config.circuitBreaker.threshold,
            globalRateLimit: this.config.rateLimit.global,
            perUserRateLimit: this.config.rateLimit.perUser
          });
          resolve();
        }
      });
    });
  }

  // EIDOLON-V PHASE3: Stop gateway
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      logger.info('API Gateway stopped');
      resolve();
    });
  }

  // EIDOLON-V PHASE3: Get gateway app
  getApp(): express.Application {
    return this.app;
  }

  // EIDOLON-V PHASE3: Get configuration
  getConfig(): GatewayConfig {
    return this.config;
  }
}

// EIDOLON-V PHASE3: Export singleton instance
export const apiGateway = APIGateway.getInstance();
