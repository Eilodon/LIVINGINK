/**
 * PHASE 2: Load Testing Infrastructure
 * Automated stress testing for enterprise scalability validation
 */

import { logger } from '../logging/Logger';

export interface LoadTestConfig {
  name: string;
  description: string;
  targetUrl: string;
  concurrentUsers: number;
  duration: number; // seconds
  rampUpTime: number; // seconds
  requestsPerSecond: number;
  endpoints: LoadTestEndpoint[];
}

export interface LoadTestEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  weight: number; // relative frequency
  payload?: any;
  headers?: Record<string, string>;
}

export interface LoadTestResult {
  testName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  statusCodes: Record<number, number>;
  errors: Array<{
    error: string;
    count: number;
    timestamp: Date;
  }>;
  performanceMetrics: {
    cpu: number[];
    memory: number[];
    network: number[];
  };
}

export interface VirtualUser {
  id: string;
  session: string;
  requests: number;
  errors: number;
  lastActivity: Date;
}

export class LoadTester {
  private static instance: LoadTester;
  private activeTests: Map<string, LoadTestResult> = new Map();
  private virtualUsers: Map<string, VirtualUser> = new Map();
  
  static getInstance(): LoadTester {
    if (!LoadTester.instance) {
      LoadTester.instance = new LoadTester();
    }
    return LoadTester.instance;
  }
  
  // EIDOLON-V PHASE2: Run load test
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    logger.info('Starting load test', {
      name: config.name,
      users: config.concurrentUsers,
      duration: config.duration,
      rps: config.requestsPerSecond
    });
    
    const result: LoadTestResult = {
      testName: config.name,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      statusCodes: {},
      errors: [],
      performanceMetrics: {
        cpu: [],
        memory: [],
        network: []
      }
    };
    
    try {
      // Initialize virtual users
      await this.initializeVirtualUsers(config.concurrentUsers);
      
      // Start performance monitoring
      const monitoringInterval = this.startPerformanceMonitoring(result);
      
      // Execute load test
      await this.executeLoadTest(config, result);
      
      // Stop monitoring
      clearInterval(monitoringInterval);
      
      // Calculate final metrics
      this.calculateFinalMetrics(result);
      
      result.endTime = new Date();
      result.duration = (result.endTime.getTime() - result.startTime.getTime()) / 1000;
      
      logger.info('Load test completed', {
        name: config.name,
        duration: result.duration,
        totalRequests: result.totalRequests,
        errorRate: result.errorRate,
        avgResponseTime: result.averageResponseTime
      });
      
      return result;
    } catch (error) {
      logger.error('Load test failed', { name: config.name }, error instanceof Error ? error : undefined);
      throw error;
    } finally {
      // Cleanup
      this.cleanup();
    }
  }
  
  // EIDOLON-V PHASE2: Initialize virtual users
  private async initializeVirtualUsers(count: number): Promise<void> {
    logger.info('Initializing virtual users', { count });
    
    for (let i = 0; i < count; i++) {
      const user: VirtualUser = {
        id: `user_${i}`,
        session: `session_${Date.now()}_${i}`,
        requests: 0,
        errors: 0,
        lastActivity: new Date()
      };
      
      this.virtualUsers.set(user.id, user);
    }
  }
  
  // EIDOLON-V PHASE2: Execute load test
  private async executeLoadTest(config: LoadTestConfig, result: LoadTestResult): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + (config.duration * 1000);
    
    // Create weighted endpoint distribution
    const endpoints = this.createWeightedEndpoints(config.endpoints);
    
    // Ramp up users gradually
    await this.rampUpUsers(config.rampUpTime, config.concurrentUsers);
    
    // Main test loop
    while (Date.now() < endTime) {
      const batchStartTime = Date.now();
      const batchEnd = batchStartTime + 1000; // 1 second batches
      
      // Execute requests for this second
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < config.requestsPerSecond; i++) {
        const endpoint = this.selectRandomEndpoint(endpoints);
        const user = this.getRandomVirtualUser();
        
        if (user && endpoint) {
          promises.push(this.executeRequest(config.targetUrl, endpoint, user, result));
        }
      }
      
      // Wait for batch to complete
      await Promise.allSettled(promises);
      
      // Wait for remaining time in this second
      const batchDuration = Date.now() - batchStartTime;
      if (batchDuration < 1000) {
        await this.sleep(1000 - batchDuration);
      }
    }
  }
  
  // EIDOLON-V PHASE2: Execute single request
  private async executeRequest(
    baseUrl: string,
    endpoint: LoadTestEndpoint,
    user: VirtualUser,
    result: LoadTestResult
  ): Promise<void> {
    const startTime = Date.now();
    user.requests++;
    user.lastActivity = new Date();
    
    try {
      const url = `${baseUrl}${endpoint.path}`;
      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LoadTester/1.0',
          'X-User-ID': user.id,
          'X-Session-ID': user.session,
          ...endpoint.headers
        }
      };
      
      if (endpoint.payload && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
        options.body = JSON.stringify(endpoint.payload);
      }
      
      const response = await fetch(url, options);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Update metrics
      result.totalRequests++;
      result.successfulRequests++;
      
      // Response time metrics
      result.averageResponseTime = ((result.averageResponseTime * (result.totalRequests - 1)) + responseTime) / result.totalRequests;
      result.minResponseTime = Math.min(result.minResponseTime, responseTime);
      result.maxResponseTime = Math.max(result.maxResponseTime, responseTime);
      
      // Status code tracking
      const statusCode = response.status;
      result.statusCodes[statusCode] = (result.statusCodes[statusCode] || 0) + 1;
      
      // Check for errors
      if (!response.ok) {
        result.failedRequests++;
        const errorKey = `HTTP_${statusCode}`;
        const existingError = result.errors.find(e => e.error === errorKey);
        
        if (existingError) {
          existingError.count++;
        } else {
          result.errors.push({
            error: errorKey,
            count: 1,
            timestamp: new Date()
          });
        }
        
        user.errors++;
      }
      
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      result.totalRequests++;
      result.failedRequests++;
      result.errors.push({
        error: error instanceof Error ? error.message : String(error),
        count: 1,
        timestamp: new Date()
      });
      
      user.errors++;
      
      // Update response time metrics even for errors
      result.averageResponseTime = ((result.averageResponseTime * (result.totalRequests - 1)) + responseTime) / result.totalRequests;
      result.minResponseTime = Math.min(result.minResponseTime, responseTime);
      result.maxResponseTime = Math.max(result.maxResponseTime, responseTime);
    }
  }
  
  // EIDOLON-V PHASE2: Create weighted endpoint distribution
  private createWeightedEndpoints(endpoints: LoadTestEndpoint[]): LoadTestEndpoint[] {
    const weighted: LoadTestEndpoint[] = [];
    
    for (const endpoint of endpoints) {
      for (let i = 0; i < endpoint.weight; i++) {
        weighted.push(endpoint);
      }
    }
    
    return weighted;
  }
  
  // EIDOLON-V PHASE2: Select random endpoint
  private selectRandomEndpoint(endpoints: LoadTestEndpoint[]): LoadTestEndpoint | null {
    if (endpoints.length === 0) return null;
    
    const index = Math.floor(Math.random() * endpoints.length);
    return endpoints[index];
  }
  
  // EIDOLON-V PHASE2: Get random virtual user
  private getRandomVirtualUser(): VirtualUser | null {
    if (this.virtualUsers.size === 0) return null;
    
    const users = Array.from(this.virtualUsers.values());
    const index = Math.floor(Math.random() * users.length);
    return users[index];
  }
  
  // EIDOLON-V PHASE2: Ramp up users gradually
  private async rampUpUsers(rampUpTime: number, targetUsers: number): Promise<void> {
    logger.info('Ramping up users', { rampUpTime, targetUsers });
    
    const rampUpInterval = rampUpTime / targetUsers;
    const currentUsers = this.virtualUsers.size;
    
    for (let i = 0; i < targetUsers - currentUsers; i++) {
      await this.sleep(rampUpInterval * 1000);
      
      // Activate next user
      const users = Array.from(this.virtualUsers.values());
      if (i < users.length) {
        users[i].lastActivity = new Date();
      }
    }
  }
  
  // EIDOLON-V PHASE2: Start performance monitoring
  private startPerformanceMonitoring(result: LoadTestResult): NodeJS.Timeout {
    return setInterval(() => {
      // Collect system metrics
      const memUsage = process.memoryUsage();
      
      result.performanceMetrics.cpu.push(0); // Would use actual CPU monitoring
      result.performanceMetrics.memory.push(memUsage.heapUsed);
      result.performanceMetrics.network.push(0); // Would use actual network monitoring
      
      // Keep only last 100 samples
      if (result.performanceMetrics.cpu.length > 100) {
        result.performanceMetrics.cpu.shift();
        result.performanceMetrics.memory.shift();
        result.performanceMetrics.network.shift();
      }
    }, 1000);
  }
  
  // EIDOLON-V PHASE2: Calculate final metrics
  private calculateFinalMetrics(result: LoadTestResult): void {
    result.errorRate = result.totalRequests > 0 ? (result.failedRequests / result.totalRequests) * 100 : 0;
    result.requestsPerSecond = result.duration > 0 ? result.totalRequests / result.duration : 0;
    
    // Calculate average performance metrics
    if (result.performanceMetrics.cpu.length > 0) {
      const avgCpu = result.performanceMetrics.cpu.reduce((sum, val) => sum + val, 0) / result.performanceMetrics.cpu.length;
      const avgMemory = result.performanceMetrics.memory.reduce((sum, val) => sum + val, 0) / result.performanceMetrics.memory.length;
      const avgNetwork = result.performanceMetrics.network.reduce((sum, val) => sum + val, 0) / result.performanceMetrics.network.length;
      
      // Replace arrays with averages
      result.performanceMetrics.cpu = [avgCpu];
      result.performanceMetrics.memory = [avgMemory];
      result.performanceMetrics.network = [avgNetwork];
    }
  }
  
  // EIDOLON-V PHASE2: Sleep helper
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // EIDOLON-V PHASE2: Cleanup
  private cleanup(): void {
    this.virtualUsers.clear();
  }
  
  // EIDOLON-V PHASE2: Get predefined test configurations
  getTestConfigs(): LoadTestConfig[] {
    return [
      {
        name: 'api_health_check',
        description: 'Basic health check load test',
        targetUrl: 'http://localhost:2567',
        concurrentUsers: 10,
        duration: 60,
        rampUpTime: 10,
        requestsPerSecond: 20,
        endpoints: [
          {
            path: '/health',
            method: 'GET',
            weight: 100
          }
        ]
      },
      {
        name: 'api_auth_load',
        description: 'Authentication endpoint load test',
        targetUrl: 'http://localhost:2567',
        concurrentUsers: 50,
        duration: 120,
        rampUpTime: 30,
        requestsPerSecond: 100,
        endpoints: [
          {
            path: '/auth/login',
            method: 'POST',
            weight: 30,
            payload: {
              username: 'testuser',
              password: 'testpass'
            }
          },
          {
            path: '/auth/verify',
            method: 'GET',
            weight: 70,
            headers: {
              'Authorization': 'Bearer test_token'
            }
          }
        ]
      },
      {
        name: 'api_game_load',
        description: 'Game API load test',
        targetUrl: 'http://localhost:2567',
        concurrentUsers: 100,
        duration: 300,
        rampUpTime: 60,
        requestsPerSecond: 200,
        endpoints: [
          {
            path: '/info',
            method: 'GET',
            weight: 40,
            headers: {
              'Authorization': 'Bearer test_token'
            }
          },
          {
            path: '/monitoring/metrics',
            method: 'GET',
            weight: 30,
            headers: {
              'Authorization': 'Bearer test_token'
            }
          },
          {
            path: '/monitoring/health',
            method: 'GET',
            weight: 30
          }
        ]
      }
    ];
  }
  
  // EIDOLON-V PHASE2: Run all predefined tests
  async runAllTests(): Promise<LoadTestResult[]> {
    const configs = this.getTestConfigs();
    const results: LoadTestResult[] = [];
    
    for (const config of configs) {
      try {
        const result = await this.runLoadTest(config);
        results.push(result);
        
        // Wait between tests
        await this.sleep(5000);
      } catch (error) {
        logger.error('Test failed', { name: config.name }, error instanceof Error ? error : undefined);
      }
    }
    
    return results;
  }
  
  // EIDOLON-V PHASE2: Generate test report
  generateReport(results: LoadTestResult[]): string {
    let report = '# Load Test Report\\n\\n';
    report += `Generated: ${new Date().toISOString()}\\n\\n`;
    
    for (const result of results) {
      report += `## ${result.testName}\\n`;
      report += `- Duration: ${result.duration}s\\n`;
      report += `- Total Requests: ${result.totalRequests}\\n`;
      report += `- Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%\\n`;
      report += `- Average Response Time: ${result.averageResponseTime.toFixed(2)}ms\\n`;
      report += `- Requests/sec: ${result.requestsPerSecond.toFixed(2)}\\n`;
      report += `- Error Rate: ${result.errorRate.toFixed(2)}%\\n\\n`;
      
      if (result.errors.length > 0) {
        report += '### Errors:\\n';
        for (const error of result.errors) {
          report += `- ${error.error}: ${error.count} times\\n`;
        }
        report += '\\n';
      }
    }
    
    return report;
  }
}

// EIDOLON-V PHASE2: Export singleton instance
export const loadTester = LoadTester.getInstance();
