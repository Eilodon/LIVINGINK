// EIDOLON-V FIX: Production Security System
// Comprehensive security validation and input sanitization

export interface SecurityConfig {
  enableInputValidation: boolean;
  enablePositionValidation: boolean;
  enableStatValidation: boolean;
  enableAntiCheat: boolean;
  maxPositionChange: number;
  maxSpeedMultiplier: number;
  maxGrowthRate: number;
  maxScoreRate: number;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  correctedValue?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PositionValidation {
  isValid: boolean;
  reason?: string;
  correctedPosition?: { x: number; y: number };
}

export class ProductionSecurityManager {
  private static instance: ProductionSecurityManager;
  private config: SecurityConfig;
  private lastUpdateTime: Map<string, number> = new Map();
  private suspiciousActivity: Map<string, number> = new Map();
  private bannedPlayers: Set<string> = new Set();
  private securityLog: Array<{
    timestamp: number;
    playerId: string;
    type: string;
    severity: string;
    details: string;
  }> = [];

  private constructor() {
    this.config = {
      enableInputValidation: true,
      enablePositionValidation: true,
      enableStatValidation: true,
      enableAntiCheat: true,
      maxPositionChange: 500, // Max pixels per frame
      maxSpeedMultiplier: 3.0, // Max speed boost
      maxGrowthRate: 50, // Max size growth per second
      maxScoreRate: 100 // Max score per second
    };
  }

  public static getInstance(): ProductionSecurityManager {
    if (!ProductionSecurityManager.instance) {
      ProductionSecurityManager.instance = new ProductionSecurityManager();
    }
    return ProductionSecurityManager.instance;
  }

  // EIDOLON-V FIX: Validate player position to prevent teleportation hacks
  public validatePosition(
    sessionId: string,
    newPosition: { x: number; y: number },
    oldPosition: { x: number; y: number },
    deltaTime: number
  ): PositionValidation {
    if (!this.config.enablePositionValidation) {
      return { isValid: true };
    }

    // Check for teleportation (speed hack)
    const distance = Math.sqrt(
      Math.pow(newPosition.x - oldPosition.x, 2) + 
      Math.pow(newPosition.y - oldPosition.y, 2)
    );

    const maxDistance = this.config.maxPositionChange * deltaTime;
    
    if (distance > maxDistance) {
      this.logSecurityEvent(sessionId, 'position_hack', 'high', 
        `Distance: ${distance.toFixed(2)}, Max: ${maxDistance.toFixed(2)}`);
      
      // Return corrected position
      const angle = Math.atan2(newPosition.y - oldPosition.y, newPosition.x - oldPosition.x);
      const correctedX = oldPosition.x + Math.cos(angle) * maxDistance;
      const correctedY = oldPosition.y + Math.sin(angle) * maxDistance;
      
      return {
        isValid: false,
        reason: 'Teleportation detected - position corrected',
        correctedPosition: { x: correctedX, y: correctedY }
      };
    }

    // Check for out-of-bounds positions
    const mapRadius = 3000; // MAP_RADIUS
    const distFromCenter = Math.sqrt(newPosition.x * newPosition.x + newPosition.y * newPosition.y);
    
    if (distFromCenter > mapRadius) {
      this.logSecurityEvent(sessionId, 'out_of_bounds', 'medium', 
        `Distance from center: ${distFromCenter.toFixed(2)}`);
      
      // Clamp to map boundary
      const angle = Math.atan2(newPosition.y, newPosition.x);
      const clampedX = Math.cos(angle) * mapRadius * 0.95;
      const clampedY = Math.sin(angle) * mapRadius * 0.95;
      
      return {
        isValid: false,
        reason: 'Out of bounds - position clamped',
        correctedPosition: { x: clampedX, y: clampedY }
      };
    }

    return { isValid: true };
  }

  // EIDOLON-V FIX: Validate player stats to prevent stat modification hacks
  public validatePlayerStats(
    sessionId: string,
    newStats: any,
    oldStats: any,
    deltaTime: number
  ): ValidationResult {
    if (!this.config.enableStatValidation) {
      return { isValid: true, severity: 'low' };
    }

    const issues: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check health regeneration
    if (newStats.currentHealth > oldStats.currentHealth) {
      const healthDiff = newStats.currentHealth - oldStats.currentHealth;
      const maxHealthRegen = 10 * deltaTime; // Max 10 health per second
      
      if (healthDiff > maxHealthRegen) {
        issues.push(`Health regeneration too fast: ${healthDiff.toFixed(2)} > ${maxHealthRegen.toFixed(2)}`);
        severity = 'high';
      }
      
      if (oldStats.currentHealth <= 0) {
        issues.push('Health restored from zero - possible resurrection hack');
        severity = 'critical';
      }
    }

    // Check size growth
    if (newStats.radius > oldStats.radius) {
      const sizeDiff = newStats.radius - oldStats.radius;
      const maxGrowthRate = this.config.maxGrowthRate * deltaTime;
      
      if (sizeDiff > maxGrowthRate) {
        issues.push(`Size increased too rapidly: ${sizeDiff.toFixed(2)} > ${maxGrowthRate.toFixed(2)}`);
        severity = 'high';
      }
    }

    // Check score increase
    if (newStats.score > oldStats.score) {
      const scoreDiff = newStats.score - oldStats.score;
      const maxScoreRate = this.config.maxScoreRate * deltaTime;
      
      if (scoreDiff > maxScoreRate) {
        issues.push(`Score increased too rapidly: ${scoreDiff.toFixed(2)} > ${maxScoreRate.toFixed(2)}`);
        severity = 'medium';
      }
    }

    // Check speed multiplier
    if (newStats.maxSpeed > oldStats.maxSpeed) {
      const speedMultiplier = newStats.maxSpeed / oldStats.maxSpeed;
      
      if (speedMultiplier > this.config.maxSpeedMultiplier) {
        issues.push(`Speed multiplier too high: ${speedMultiplier.toFixed(2)} > ${this.config.maxSpeedMultiplier}`);
        severity = 'high';
      }
    }

    // Log security event if issues found
    if (issues.length > 0) {
      this.logSecurityEvent(sessionId, 'stat_hack', severity, issues.join('; '));
      
      // Ban for critical violations
      if (severity === 'critical') {
        this.banPlayer(sessionId, 'Critical stat manipulation detected');
      }
    }

    return {
      isValid: issues.length === 0,
      reason: issues.join('; '),
      severity
    };
  }

  // EIDOLON-V FIX: Validate input data
  public validateInput(sessionId: string, input: any): ValidationResult {
    if (!this.config.enableInputValidation) {
      return { isValid: true, severity: 'low' };
    }

    const issues: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check for malformed input
    if (!input || typeof input !== 'object') {
      issues.push('Malformed input data');
      severity = 'high';
      return {
        isValid: false,
        reason: issues.join('; '),
        severity
      };
    }

    // Check for invalid values
    if (input.targetX !== undefined && (isNaN(input.targetX) || !isFinite(input.targetX))) {
      issues.push('Invalid targetX value');
      severity = 'medium';
    }

    if (input.targetY !== undefined && (isNaN(input.targetY) || !isFinite(input.targetY))) {
      issues.push('Invalid targetY value');
      severity = 'medium';
    }

    // Check for rapid input spam
    const now = Date.now();
    const lastUpdate = this.lastUpdateTime.get(sessionId) || 0;
    const timeSinceLastUpdate = now - lastUpdate;

    if (timeSinceLastUpdate < 16) { // Less than 60fps
      issues.push('Input spam detected');
      severity = 'low';
    }

    this.lastUpdateTime.set(sessionId, now);

    return {
      isValid: issues.length === 0,
      reason: issues.join('; '),
      severity
    };
  }

  // EIDOLON-V FIX: Anti-cheat detection
  public detectCheating(sessionId: string, playerData: any): ValidationResult {
    if (!this.config.enableAntiCheat) {
      return { isValid: true, severity: 'low' };
    }

    const issues: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check for impossible combinations
    if (playerData.statusEffects) {
      const effects = playerData.statusEffects;
      
      // Check for multiple incompatible effects
      const incompatibleEffects = [
        ['speedBoost', 'invulnerable'],
        ['overdriveExplosive', 'elementalBalance']
      ];

      for (const [effect1, effect2] of incompatibleEffects) {
        if (effects[effect1] && effects[effect2]) {
          issues.push(`Incompatible effects: ${effect1} + ${effect2}`);
          severity = 'high';
        }
      }
    }

    // Check for suspicious patterns
    const suspiciousCount = this.suspiciousActivity.get(sessionId) || 0;
    if (suspiciousCount > 10) {
      issues.push(`High suspicious activity count: ${suspiciousCount}`);
      severity = 'critical';
      this.banPlayer(sessionId, 'Excessive suspicious activity');
    }

    return {
      isValid: issues.length === 0,
      reason: issues.join('; '),
      severity
    };
  }

  // EIDOLON-V FIX: Ban player
  public banPlayer(sessionId: string, reason: string): void {
    this.bannedPlayers.add(sessionId);
    this.logSecurityEvent(sessionId, 'player_banned', 'critical', reason);
  }

  // EIDOLON-V FIX: Check if player is banned
  public isPlayerBanned(sessionId: string): boolean {
    return this.bannedPlayers.has(sessionId);
  }

  // EIDOLON-V FIX: Get security report
  public getSecurityReport(): {
    timestamp: number;
    bannedPlayers: number;
    suspiciousActivity: number;
    recentEvents: any[];
    recommendations: string[];
  } {
    const recentEvents = this.securityLog.slice(-100); // Last 100 events
    
    return {
      timestamp: Date.now(),
      bannedPlayers: this.bannedPlayers.size,
      suspiciousActivity: this.suspiciousActivity.size,
      recentEvents,
      recommendations: this.generateRecommendations()
    };
  }

  // EIDOLON-V FIX: Clear old security data
  public cleanup(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Clear old security logs
    this.securityLog = this.securityLog.filter(event => 
      now - event.timestamp < oneHour
    );

    // Clear old suspicious activity
    for (const [sessionId, timestamp] of this.suspiciousActivity) {
      if (now - timestamp > oneHour) {
        this.suspiciousActivity.delete(sessionId);
      }
    }
  }

  private logSecurityEvent(
    sessionId: string,
    type: string,
    severity: string,
    details: string
  ): void {
    const event = {
      timestamp: Date.now(),
      playerId: sessionId,
      type,
      severity,
      details
    };

    this.securityLog.push(event);

    // Track suspicious activity
    const currentCount = this.suspiciousActivity.get(sessionId) || 0;
    this.suspiciousActivity.set(sessionId, currentCount + 1);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.bannedPlayers.size > 10) {
      recommendations.push('High number of banned players - consider strengthening security measures');
    }
    
    if (this.suspiciousActivity.size > 50) {
      recommendations.push('High suspicious activity detected - consider implementing rate limiting');
    }
    
    const criticalEvents = this.securityLog.filter(e => e.severity === 'critical');
    if (criticalEvents.length > 5) {
      recommendations.push('Multiple critical security events - investigate immediately');
    }
    
    return recommendations;
  }
}

// EIDOLON-V FIX: Export singleton instance
export const productionSecurityManager = ProductionSecurityManager.getInstance();
