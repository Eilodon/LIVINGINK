/**
 * PHASE 2: Performance Profiler
 * Real-time performance analysis and bottleneck detection
 */

import { logger } from '../logging/Logger';

export interface PerformanceMetrics {
  timestamp: number;
  operation: string;
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
  context?: any;
}

export interface PerformanceReport {
  operation: string;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  callCount: number;
  totalDuration: number;
  memoryImpact: number;
  cpuImpact: number;
  efficiency: number; // 0-100 score
}

export class PerformanceProfiler {
  private static instance: PerformanceProfiler;
  private metrics: PerformanceMetrics[] = [];
  private operationStats: Map<string, PerformanceReport> = new Map();
  private maxMetricsSize = 10000;
  private isProfiling = false;
  
  static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }
  
  // EIDOLON-V PHASE2: Start profiling
  startProfiling(): void {
    this.isProfiling = true;
    logger.info('Performance profiling started');
  }
  
  // EIDOLON-V PHASE2: Stop profiling
  stopProfiling(): void {
    this.isProfiling = false;
    logger.info('Performance profiling stopped');
  }
  
  // EIDOLON-V PHASE2: Profile an operation
  async profile<T>(
    operation: string,
    fn: () => Promise<T> | T,
    context?: any
  ): Promise<T> {
    if (!this.isProfiling) {
      return fn();
    }
    
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;
    const startCPU = process.cpuUsage();
    
    try {
      const result = await fn();
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage().heapUsed;
      const endCPU = process.cpuUsage(startCPU);
      
      const duration = Number(endTime - startTime) / 1000000; // Convert to ms
      const memoryDelta = endMemory - startMemory;
      const cpuDelta = (endCPU.user + endCPU.system) / 1000; // Convert to ms
      
      this.recordMetric({
        timestamp: Date.now(),
        operation,
        duration,
        memoryUsage: memoryDelta,
        cpuUsage: cpuDelta,
        context
      });
      
      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      logger.error('Profiled operation failed', {
        operation,
        duration,
        context
      }, error instanceof Error ? error : undefined);
      
      throw error;
    }
  }
  
  // EIDOLON-V PHASE2: Record performance metric
  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Trim if too many metrics
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics = this.metrics.slice(-this.maxMetricsSize);
    }
    
    // Update operation stats
    this.updateOperationStats(metric);
  }
  
  // EIDOLON-V PHASE2: Update operation statistics
  private updateOperationStats(metric: PerformanceMetrics): void {
    const existing = this.operationStats.get(metric.operation);
    
    if (existing) {
      // Update existing stats
      existing.callCount++;
      existing.totalDuration += metric.duration;
      existing.avgDuration = existing.totalDuration / existing.callCount;
      existing.maxDuration = Math.max(existing.maxDuration, metric.duration);
      existing.minDuration = Math.min(existing.minDuration, metric.duration);
      existing.memoryImpact += metric.memoryUsage;
      existing.cpuImpact += metric.cpuUsage;
      
      // Calculate efficiency score (0-100)
      existing.efficiency = this.calculateEfficiency(existing);
    } else {
      // Create new stats
      this.operationStats.set(metric.operation, {
        operation: metric.operation,
        avgDuration: metric.duration,
        maxDuration: metric.duration,
        minDuration: metric.duration,
        callCount: 1,
        totalDuration: metric.duration,
        memoryImpact: metric.memoryUsage,
        cpuImpact: metric.cpuUsage,
        efficiency: this.calculateEfficiency({
          operation: metric.operation,
          avgDuration: metric.duration,
          maxDuration: metric.duration,
          minDuration: metric.duration,
          callCount: 1,
          totalDuration: metric.duration,
          memoryImpact: metric.memoryUsage,
          cpuImpact: metric.cpuUsage,
          efficiency: 0
        })
      });
    }
  }
  
  // EIDOLON-V PHASE2: Calculate efficiency score
  private calculateEfficiency(stats: PerformanceReport): number {
    // Efficiency based on duration consistency and resource usage
    const durationVariance = stats.maxDuration - stats.minDuration;
    const avgDuration = stats.avgDuration;
    
    // Lower variance and lower resource usage = higher efficiency
    const varianceScore = Math.max(0, 100 - (durationVariance / avgDuration) * 100);
    const resourceScore = Math.max(0, 100 - (stats.memoryImpact + stats.cpuImpact) / 10000);
    
    return Math.round((varianceScore + resourceScore) / 2);
  }
  
  // EIDOLON-V PHASE2: Get performance report
  getReport(): {
    summary: {
      totalOperations: number;
      avgDuration: number;
      totalMemoryImpact: number;
      totalCpuImpact: number;
    };
    operations: PerformanceReport[];
    bottlenecks: PerformanceReport[];
    recommendations: string[];
  } {
    const operations = Array.from(this.operationStats.values())
      .sort((a, b) => b.avgDuration - a.avgDuration);
    
    const bottlenecks = operations.filter(op => 
      op.efficiency < 50 || op.avgDuration > 100
    ).slice(0, 10);
    
    const recommendations = this.generateRecommendations(bottlenecks);
    
    const summary = {
      totalOperations: operations.reduce((sum, op) => sum + op.callCount, 0),
      avgDuration: operations.reduce((sum, op) => sum + op.avgDuration, 0) / operations.length,
      totalMemoryImpact: operations.reduce((sum, op) => sum + op.memoryImpact, 0),
      totalCpuImpact: operations.reduce((sum, op) => sum + op.cpuImpact, 0)
    };
    
    return {
      summary,
      operations,
      bottlenecks,
      recommendations
    };
  }
  
  // EIDOLON-V PHASE2: Generate optimization recommendations
  private generateRecommendations(bottlenecks: PerformanceReport[]): string[] {
    const recommendations: string[] = [];
    
    for (const bottleneck of bottlenecks) {
      if (bottleneck.avgDuration > 200) {
        recommendations.push(
          `⚠️ ${bottleneck.operation}: High average duration (${bottleneck.avgDuration.toFixed(2)}ms) - Consider caching or optimization`
        );
      }
      
      if (bottleneck.memoryImpact > 1000000) { // 1MB
        recommendations.push(
          `🧠 ${bottleneck.operation}: High memory impact (${(bottleneck.memoryImpact / 1024 / 1024).toFixed(2)}MB) - Check for memory leaks`
        );
      }
      
      if (bottleneck.callCount > 1000) {
        recommendations.push(
          `🔄 ${bottleneck.operation}: High call count (${bottleneck.callCount}) - Consider batching or debouncing`
        );
      }
      
      if (bottleneck.efficiency < 30) {
        recommendations.push(
          `📉 ${bottleneck.operation}: Low efficiency (${bottleneck.efficiency}%) - High variance in performance`
        );
      }
    }
    
    return recommendations;
  }
  
  // EIDOLON-V PHASE2: Get recent metrics
  getRecentMetrics(count: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }
  
  // EIDOLON-V PHASE2: Get metrics by operation
  getMetricsByOperation(operation: string, count: number = 100): PerformanceMetrics[] {
    return this.metrics
      .filter(m => m.operation === operation)
      .slice(-count);
  }
  
  // EIDOLON-V PHASE2: Clear metrics
  clearMetrics(): void {
    this.metrics = [];
    this.operationStats.clear();
    logger.info('Performance metrics cleared');
  }
  
  // EIDOLON-V PHASE2: Export metrics for analysis
  exportMetrics(): string {
    const report = this.getReport();
    return JSON.stringify(report, null, 2);
  }
}

// EIDOLON-V PHASE2: Decorator for automatic profiling
export function profile(operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const profiler = PerformanceProfiler.getInstance();
    const operationName = operation || `${target.constructor.name}.${propertyName}`;
    
    descriptor.value = function (...args: any[]) {
      return profiler.profile(operationName, () => method.apply(this, args), {
        args: args.length,
        className: target.constructor.name,
        method: propertyName
      });
    };
    
    return descriptor;
  };
}

// EIDOLON-V PHASE2: Export singleton instance
export const profiler = PerformanceProfiler.getInstance();
