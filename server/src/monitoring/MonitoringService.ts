/**
 * PHASE 1 EMERGENCY: Basic Monitoring System
 * Real-time metrics and alerting for production safety
 */

export interface ServerMetrics {
  timestamp: number;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  network: {
    connections: number;
    requestsPerSecond: number;
  };
  game: {
    activeRooms: number;
    totalPlayers: number;
    averagePing: number;
  };
  security: {
    rateLimitHits: number;
    authFailures: number;
    suspiciousActivity: number;
  };
}

export interface Alert {
  id: string;
  type: 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: ServerMetrics[] = [];
  private alerts: Alert[] = [];
  private requestCounts: Map<string, number> = new Map();
  private lastCleanup = Date.now();
  private startTime = Date.now();
  
  // EIDOLON-V PHASE1: Alert thresholds
  private readonly THRESHOLDS = {
    memoryUsage: 0.85, // 85%
    cpuUsage: 0.80,    // 80%
    maxPlayers: 45,    // 45/50 rooms
    maxPing: 200,      // 200ms
    suspiciousRate: 10 // 10 suspicious activities per minute
  };
  
  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }
  
  // EIDOLON-V PHASE1: Collect current metrics
  collectMetrics(): ServerMetrics {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const memTotal = memUsage.heapTotal + memUsage.external;
    const memUsed = memUsage.heapUsed + memUsage.external;
    
    // EIDOLON-V PHASE1: Simple CPU estimation (would use proper CPU monitoring in production)
    const cpuUsage = this.estimateCPUUsage();
    
    // EIDOLON-V PHASE1: Calculate requests per second
    const requestsPerSecond = this.calculateRequestsPerSecond();
    
    const metrics: ServerMetrics = {
      timestamp: now,
      uptime: now - this.startTime,
      memory: {
        used: memUsed,
        total: memTotal,
        percentage: memUsed / memTotal
      },
      cpu: {
        usage: cpuUsage
      },
      network: {
        connections: this.requestCounts.size,
        requestsPerSecond
      },
      game: {
        activeRooms: 0, // Would be populated from actual game server
        totalPlayers: 0, // Would be populated from actual game server
        averagePing: 0   // Would be populated from actual game server
      },
      security: {
        rateLimitHits: 0, // Would be populated from security middleware
        authFailures: 0,  // Would be populated from auth service
        suspiciousActivity: 0
      }
    };
    
    // Store metrics (keep last 1000 entries)
    this.metrics.push(metrics);
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
    
    // Check for alerts
    this.checkAlerts(metrics);
    
    // Cleanup old data
    this.cleanup();
    
    return metrics;
  }
  
  // EIDOLON-V PHASE1: Simple CPU usage estimation
  private estimateCPUUsage(): number {
    // This is a very rough estimate - in production use proper CPU monitoring
    const eventLoopDelay = this.measureEventLoopDelay();
    return Math.min(eventLoopDelay / 100, 1); // Normalize to 0-1
  }
  
  // EIDOLON-V PHASE1: Measure event loop delay
  private measureEventLoopDelay(): number {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      return delay;
    });
    return 0; // Simplified for Phase 1
  }
  
  // EIDOLON-V PHASE1: Calculate requests per second
  private calculateRequestsPerSecond(): number {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    let count = 0;
    for (const [timestamp, requestCount] of this.requestCounts) {
      if (parseInt(timestamp) > oneSecondAgo) {
        count += requestCount;
      }
    }
    
    return count;
  }
  
  // EIDOLON-V PHASE1: Record a request
  recordRequest(ip: string): void {
    const timestamp = Date.now().toString();
    const current = this.requestCounts.get(timestamp) || 0;
    this.requestCounts.set(timestamp, current + 1);
  }
  
  // EIDOLON-V PHASE1: Record security event
  recordSecurityEvent(type: 'rate_limit' | 'auth_failure' | 'suspicious', details: string): void {
    const alert: Alert = {
      id: `security-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: type === 'suspicious' ? 'critical' : 'warning',
      message: `${type.toUpperCase()}: ${details}`,
      timestamp: Date.now(),
      resolved: false
    };
    
    this.alerts.push(alert);
    console.warn(`🚨 PHASE1 Security Alert: ${alert.message}`);
  }
  
  // EIDOLON-V PHASE1: Check for alert conditions
  private checkAlerts(metrics: ServerMetrics): void {
    // Memory usage alert
    if (metrics.memory.percentage > this.THRESHOLDS.memoryUsage) {
      this.createAlert('warning', `High memory usage: ${(metrics.memory.percentage * 100).toFixed(1)}%`);
    }
    
    // CPU usage alert
    if (metrics.cpu.usage > this.THRESHOLDS.cpuUsage) {
      this.createAlert('warning', `High CPU usage: ${(metrics.cpu.usage * 100).toFixed(1)}%`);
    }
    
    // Player count alert
    if (metrics.game.totalPlayers > this.THRESHOLDS.maxPlayers) {
      this.createAlert('warning', `High player count: ${metrics.game.totalPlayers}/${this.THRESHOLDS.maxPlayers}`);
    }
    
    // Ping alert
    if (metrics.game.averagePing > this.THRESHOLDS.maxPing) {
      this.createAlert('warning', `High average ping: ${metrics.game.averagePing}ms`);
    }
  }
  
  // EIDOLON-V PHASE1: Create an alert
  private createAlert(type: 'warning' | 'critical', message: string): void {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
      resolved: false
    };
    
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(a => 
      !a.resolved && a.message === message && 
      (Date.now() - a.timestamp) < 60000 // Within last minute
    );
    
    if (!existingAlert) {
      this.alerts.push(alert);
      console.warn(`🚨 PHASE1 Alert: ${alert.message}`);
    }
  }
  
  // EIDOLON-V PHASE1: Cleanup old data
  private cleanup(): void {
    const now = Date.now();
    
    // Cleanup metrics older than 1 hour
    const oneHourAgo = now - (60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
    
    // Cleanup request counts older than 1 minute
    const oneMinuteAgo = now - (60 * 1000);
    for (const [timestamp] of this.requestCounts) {
      if (parseInt(timestamp) < oneMinuteAgo) {
        this.requestCounts.delete(timestamp);
      }
    }
    
    // Cleanup resolved alerts older than 1 hour
    this.alerts = this.alerts.filter(a => 
      !a.resolved || (a.resolved && a.resolvedAt && a.resolvedAt > oneHourAgo)
    );
  }
  
  // EIDOLON-V PHASE1: Get current metrics
  getCurrentMetrics(): ServerMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }
  
  // EIDOLON-V PHASE1: Get recent metrics
  getRecentMetrics(count: number = 10): ServerMetrics[] {
    return this.metrics.slice(-count);
  }
  
  // EIDOLON-V PHASE1: Get active alerts
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }
  
  // EIDOLON-V PHASE1: Resolve an alert
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      console.log(`✅ PHASE1 Alert resolved: ${alert.message}`);
      return true;
    }
    return false;
  }
  
  // EIDOLON-V PHASE1: Get system health summary
  getHealthSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: ServerMetrics | null;
  } {
    const metrics = this.getCurrentMetrics();
    const activeAlerts = this.getActiveAlerts();
    const issues: string[] = [];
    
    if (!metrics) {
      return {
        status: 'critical',
        issues: ['No metrics available'],
        metrics: null
      };
    }
    
    // Check various health indicators
    if (metrics.memory.percentage > this.THRESHOLDS.memoryUsage) {
      issues.push(`High memory usage: ${(metrics.memory.percentage * 100).toFixed(1)}%`);
    }
    
    if (metrics.cpu.usage > this.THRESHOLDS.cpuUsage) {
      issues.push(`High CPU usage: ${(metrics.cpu.usage * 100).toFixed(1)}%`);
    }
    
    if (activeAlerts.some(a => a.type === 'critical')) {
      issues.push('Critical alerts active');
    }
    
    const status = issues.length === 0 ? 'healthy' : 
                   issues.some(i => i.includes('Critical')) ? 'critical' : 'warning';
    
    return {
      status,
      issues,
      metrics
    };
  }
}

// EIDOLON-V PHASE1: Export singleton instance
export const monitoringService = MonitoringService.getInstance();
