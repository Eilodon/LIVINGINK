/**
 * PHASE 3: Microservices Architecture Design
 * Cloud-native service decomposition for enterprise scale
 */

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  port: number;
  healthCheck: string;
  dependencies: string[];
  database: {
    type: 'postgresql' | 'redis' | 'mongodb' | 'none';
    connectionPool?: number;
  };
  scaling: {
    minInstances: number;
    maxInstances: number;
    targetCPU: number;
    targetMemory: number;
  };
  endpoints: ServiceEndpoint[];
}

export interface ServiceEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  authentication: boolean;
  rateLimit?: {
    requests: number;
    window: number;
  };
  timeout: number;
}

export interface ServiceRegistry {
  services: Map<string, ServiceDefinition>;
  dependencies: Map<string, Set<string>>;
  healthStatus: Map<string, ServiceHealth>;
}

export interface ServiceHealth {
  serviceId: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  responseTime: number;
  uptime: number;
  errorRate: number;
  version: string;
}

// EIDOLON-V PHASE3: Core Microservices Definition
export const MICROSERVICES: ServiceDefinition[] = [
  {
    id: 'api-gateway',
    name: 'API Gateway',
    description: 'Central API gateway for routing and authentication',
    version: '1.0.0',
    port: 3000,
    healthCheck: '/health',
    dependencies: ['auth-service', 'user-service', 'game-service', 'analytics-service'],
    database: { type: 'redis' },
    scaling: {
      minInstances: 2,
      maxInstances: 10,
      targetCPU: 70,
      targetMemory: 512
    },
    endpoints: [
      {
        path: '/api/v1/auth/*',
        method: 'POST',
        description: 'Authentication endpoints',
        authentication: false,
        rateLimit: { requests: 100, window: 60 },
        timeout: 5000
      },
      {
        path: '/api/v1/users/*',
        method: 'GET',
        description: 'User management endpoints',
        authentication: true,
        rateLimit: { requests: 50, window: 60 },
        timeout: 3000
      },
      {
        path: '/api/v1/game/*',
        method: 'POST',
        description: 'Game endpoints',
        authentication: true,
        rateLimit: { requests: 200, window: 60 },
        timeout: 10000
      }
    ]
  },
  {
    id: 'auth-service',
    name: 'Authentication Service',
    description: 'Handles user authentication, authorization, and session management',
    version: '1.0.0',
    port: 3001,
    healthCheck: '/health',
    dependencies: ['user-service'],
    database: { type: 'postgresql', connectionPool: 10 },
    scaling: {
      minInstances: 2,
      maxInstances: 5,
      targetCPU: 60,
      targetMemory: 256
    },
    endpoints: [
      {
        path: '/auth/login',
        method: 'POST',
        description: 'User login',
        authentication: false,
        rateLimit: { requests: 20, window: 60 },
        timeout: 3000
      },
      {
        path: '/auth/register',
        method: 'POST',
        description: 'User registration',
        authentication: false,
        rateLimit: { requests: 10, window: 60 },
        timeout: 5000
      },
      {
        path: '/auth/verify',
        method: 'GET',
        description: 'Token verification',
        authentication: false,
        rateLimit: { requests: 100, window: 60 },
        timeout: 1000
      },
      {
        path: '/auth/logout',
        method: 'POST',
        description: 'User logout',
        authentication: true,
        rateLimit: { requests: 50, window: 60 },
        timeout: 2000
      }
    ]
  },
  {
    id: 'user-service',
    name: 'User Service',
    description: 'Manages user profiles, preferences, and statistics',
    version: '1.0.0',
    port: 3002,
    healthCheck: '/health',
    dependencies: ['analytics-service'],
    database: { type: 'postgresql', connectionPool: 15 },
    scaling: {
      minInstances: 2,
      maxInstances: 8,
      targetCPU: 50,
      targetMemory: 512
    },
    endpoints: [
      {
        path: '/users/profile',
        method: 'GET',
        description: 'Get user profile',
        authentication: true,
        rateLimit: { requests: 30, window: 60 },
        timeout: 2000
      },
      {
        path: '/users/profile',
        method: 'PUT',
        description: 'Update user profile',
        authentication: true,
        rateLimit: { requests: 20, window: 60 },
        timeout: 3000
      },
      {
        path: '/users/stats',
        method: 'GET',
        description: 'Get user statistics',
        authentication: true,
        rateLimit: { requests: 40, window: 60 },
        timeout: 2000
      },
      {
        path: '/users/preferences',
        method: 'GET',
        description: 'Get user preferences',
        authentication: true,
        rateLimit: { requests: 25, window: 60 },
        timeout: 1000
      }
    ]
  },
  {
    id: 'game-service',
    name: 'Game Service',
    description: 'Core game logic, room management, and real-time gameplay',
    version: '1.0.0',
    port: 3003,
    healthCheck: '/health',
    dependencies: ['user-service', 'analytics-service', 'matchmaking-service'],
    database: { type: 'postgresql', connectionPool: 20 },
    scaling: {
      minInstances: 3,
      maxInstances: 15,
      targetCPU: 80,
      targetMemory: 1024
    },
    endpoints: [
      {
        path: '/game/rooms',
        method: 'GET',
        description: 'List available rooms',
        authentication: true,
        rateLimit: { requests: 100, window: 60 },
        timeout: 2000
      },
      {
        path: '/game/rooms',
        method: 'POST',
        description: 'Create new room',
        authentication: true,
        rateLimit: { requests: 10, window: 60 },
        timeout: 5000
      },
      {
        path: '/game/rooms/:roomId/join',
        method: 'POST',
        description: 'Join room',
        authentication: true,
        rateLimit: { requests: 50, window: 60 },
        timeout: 3000
      },
      {
        path: '/game/rooms/:roomId/leave',
        method: 'POST',
        description: 'Leave room',
        authentication: true,
        rateLimit: { requests: 50, window: 60 },
        timeout: 2000
      },
      {
        path: '/game/state/:roomId',
        method: 'GET',
        description: 'Get game state',
        authentication: true,
        rateLimit: { requests: 200, window: 60 },
        timeout: 1000
      }
    ]
  },
  {
    id: 'matchmaking-service',
    name: 'Matchmaking Service',
    description: 'Handles player matching and room allocation',
    version: '1.0.0',
    port: 3004,
    healthCheck: '/health',
    dependencies: ['game-service', 'user-service'],
    database: { type: 'redis' },
    scaling: {
      minInstances: 1,
      maxInstances: 5,
      targetCPU: 40,
      targetMemory: 256
    },
    endpoints: [
      {
        path: '/matchmaking/find',
        method: 'POST',
        description: 'Find match',
        authentication: true,
        rateLimit: { requests: 30, window: 60 },
        timeout: 10000
      },
      {
        path: '/matchmaking/cancel',
        method: 'POST',
        description: 'Cancel matchmaking',
        authentication: true,
        rateLimit: { requests: 20, window: 60 },
        timeout: 2000
      },
      {
        path: '/matchmaking/status',
        method: 'GET',
        description: 'Get matchmaking status',
        authentication: true,
        rateLimit: { requests: 40, window: 60 },
        timeout: 1000
      }
    ]
  },
  {
    id: 'analytics-service',
    name: 'Analytics Service',
    description: 'Collects and analyzes game analytics and metrics',
    version: '1.0.0',
    port: 3005,
    healthCheck: '/health',
    dependencies: [],
    database: { type: 'postgresql', connectionPool: 10 },
    scaling: {
      minInstances: 1,
      maxInstances: 3,
      targetCPU: 30,
      targetMemory: 512
    },
    endpoints: [
      {
        path: '/analytics/events',
        method: 'POST',
        description: 'Record analytics event',
        authentication: false,
        rateLimit: { requests: 1000, window: 60 },
        timeout: 1000
      },
      {
        path: '/analytics/metrics',
        method: 'GET',
        description: 'Get system metrics',
        authentication: true,
        rateLimit: { requests: 20, window: 60 },
        timeout: 3000
      },
      {
        path: '/analytics/reports',
        method: 'GET',
        description: 'Generate analytics reports',
        authentication: true,
        rateLimit: { requests: 10, window: 60 },
        timeout: 10000
      },
      {
        path: '/analytics/leaderboard',
        method: 'GET',
        description: 'Get leaderboard data',
        authentication: false,
        rateLimit: { requests: 50, window: 60 },
        timeout: 2000
      }
    ]
  },
  {
    id: 'notification-service',
    name: 'Notification Service',
    description: 'Handles real-time notifications and messaging',
    version: '1.0.0',
    port: 3006,
    healthCheck: '/health',
    dependencies: ['user-service', 'game-service'],
    database: { type: 'redis' },
    scaling: {
      minInstances: 1,
      maxInstances: 3,
      targetCPU: 30,
      targetMemory: 256
    },
    endpoints: [
      {
        path: '/notifications/send',
        method: 'POST',
        description: 'Send notification',
        authentication: true,
        rateLimit: { requests: 100, window: 60 },
        timeout: 3000
      },
      {
        path: '/notifications/subscribe',
        method: 'GET',
        description: 'Subscribe to notifications',
        authentication: true,
        rateLimit: { requests: 10, window: 60 },
        timeout: 5000
      },
      {
        path: '/notifications/history',
        method: 'GET',
        description: 'Get notification history',
        authentication: true,
        rateLimit: { requests: 30, window: 60 },
        timeout: 2000
      }
    ]
  }
];

// EIDOLON-V PHASE3: Service Registry Manager
export class ServiceRegistryManager {
  private static instance: ServiceRegistryManager;
  private registry: ServiceRegistry;
  
  private constructor() {
    this.registry = {
      services: new Map(),
      dependencies: new Map(),
      healthStatus: new Map()
    };
    
    this.initializeServices();
  }
  
  static getInstance(): ServiceRegistryManager {
    if (!ServiceRegistryManager.instance) {
      ServiceRegistryManager.instance = new ServiceRegistryManager();
    }
    return ServiceRegistryManager.instance;
  }
  
  private initializeServices(): void {
    // Register all microservices
    for (const service of MICROSERVICES) {
      this.registry.services.set(service.id, service);
      
      // Initialize dependencies
      const deps = new Set(service.dependencies);
      this.registry.dependencies.set(service.id, deps);
      
      // Initialize health status
      this.registry.healthStatus.set(service.id, {
        serviceId: service.id,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: 0,
        uptime: 0,
        errorRate: 0,
        version: service.version
      });
    }
  }
  
  // EIDOLON-V PHASE3: Get service definition
  getService(serviceId: string): ServiceDefinition | undefined {
    return this.registry.services.get(serviceId);
  }
  
  // EIDOLON-V PHASE3: Get all services
  getAllServices(): ServiceDefinition[] {
    return Array.from(this.registry.services.values());
  }
  
  // EIDOLON-V PHASE3: Get service dependencies
  getDependencies(serviceId: string): Set<string> {
    return this.registry.dependencies.get(serviceId) || new Set();
  }
  
  // EIDOLON-V PHASE3: Get service health status
  getHealthStatus(serviceId: string): ServiceHealth | undefined {
    return this.registry.healthStatus.get(serviceId);
  }
  
  // EIDOLON-V PHASE3: Update service health status
  updateHealthStatus(serviceId: string, status: Partial<ServiceHealth>): void {
    const current = this.registry.healthStatus.get(serviceId);
    if (current) {
      this.registry.healthStatus.set(serviceId, { ...current, ...status, lastCheck: new Date() });
    }
  }
  
  // EIDOLON-V PHASE3: Get dependency graph
  getDependencyGraph(): Map<string, Set<string>> {
    return new Map(this.registry.dependencies);
  }
  
  // EIDOLON-V PHASE3: Validate service dependencies
  validateDependencies(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    for (const [serviceId, dependencies] of this.registry.dependencies) {
      for (const depId of dependencies) {
        if (!this.registry.services.has(depId)) {
          errors.push(`Service ${serviceId} depends on unknown service ${depId}`);
        }
      }
    }
    
    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCircularDependency = (serviceId: string): boolean => {
      if (recursionStack.has(serviceId)) {
        return true; // Circular dependency detected
      }
      
      if (visited.has(serviceId)) {
        return false;
      }
      
      visited.add(serviceId);
      recursionStack.add(serviceId);
      
      const deps = this.registry.dependencies.get(serviceId);
      if (deps) {
        for (const depId of deps) {
          if (hasCircularDependency(depId)) {
            return true;
          }
        }
      }
      
      recursionStack.delete(serviceId);
      return false;
    };
    
    for (const serviceId of this.registry.services.keys()) {
      if (hasCircularDependency(serviceId)) {
        errors.push(`Circular dependency detected involving service ${serviceId}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  // EIDOLON-V PHASE3: Get deployment order (topological sort)
  getDeploymentOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    
    const visit = (serviceId: string) => {
      if (visited.has(serviceId)) return;
      
      const deps = this.registry.dependencies.get(serviceId);
      if (deps) {
        for (const depId of deps) {
          visit(depId);
        }
      }
      
      visited.add(serviceId);
      order.push(serviceId);
    };
    
    for (const serviceId of this.registry.services.keys()) {
      visit(serviceId);
    }
    
    return order;
  }
}

// EIDOLON-V PHASE3: Export singleton instance
export const serviceRegistry = ServiceRegistryManager.getInstance();
