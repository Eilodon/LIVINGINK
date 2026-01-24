/**
 * SERVER-AUTHORATIVE COLOR MIXING SYSTEM
 * Prevents client-server desync in color calculations
 */

// Define types locally to avoid import issues
export interface PigmentVec3 {
  r: number;
  g: number;
  b: number;
}

export interface ColorMixingEvent {
  playerId: string;
  foodId: string;
  currentPigment: PigmentVec3;
  targetPigment: PigmentVec3;
  timestamp: number;
}

export interface ColorValidationResult {
  isValid: boolean;
  serverPigment: PigmentVec3;
  clientPigment: PigmentVec3;
  matchPercent: number;
  desyncThreshold: number;
}

// Local implementation of color math functions
export const mixPigment = (current: PigmentVec3, target: PigmentVec3, ratio: number): PigmentVec3 => {
  return {
    r: current.r * (1 - ratio) + target.r * ratio,
    g: current.g * (1 - ratio) + target.g * ratio,
    b: current.b * (1 - ratio) + target.b * ratio,
  };
};

export const calcMatchPercent = (p1: PigmentVec3, p2: PigmentVec3): number => {
  const dr = p1.r - p2.r;
  const dg = p1.g - p2.g;
  const db = p1.b - p2.b;
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  const maxDist = Math.sqrt(3);
  const raw = 1 - dist / maxDist;
  const clamped = Math.max(0, Math.min(1, raw));
  return Math.pow(clamped, 1.1);
};

export class ColorMixingSystem {
  private static readonly DESYNC_THRESHOLD = 0.05; // 5% tolerance
  private static readonly SYNC_FREQUENCY = 100; // Sync every 100ms
  private static readonly MAX_DESYNC_COUNT = 3; // Max desync before forced correction
  
  private colorHistory: Map<string, { pigment: PigmentVec3; timestamp: number }[]> = new Map();
  private desyncCounters: Map<string, number> = new Map();
  private lastSyncTime: Map<string, number> = new Map();

  /**
   * Process color mixing event on server
   */
  static processColorMixing(
    playerId: string,
    currentPigment: PigmentVec3,
    targetPigment: PigmentVec3,
    mixRatio: number = 0.1
  ): PigmentVec3 {
    // Server-authoritative mixing
    const newPigment = mixPigment(currentPigment, targetPigment, mixRatio);
    
    // Clamp values to ensure validity
    newPigment.r = Math.max(0, Math.min(1, newPigment.r));
    newPigment.g = Math.max(0, Math.min(1, newPigment.g));
    newPigment.b = Math.max(0, Math.min(1, newPigment.b));
    
    return newPigment;
  }

  /**
   * Validate client color against server state
   */
  static validateClientColor(
    playerId: string,
    clientPigment: PigmentVec3,
    serverPigment: PigmentVec3
  ): ColorValidationResult {
    const matchPercent = calcMatchPercent(clientPigment, serverPigment);
    const isValid = matchPercent >= (1 - this.DESYNC_THRESHOLD);
    
    return {
      isValid,
      serverPigment,
      clientPigment,
      matchPercent,
      desyncThreshold: this.DESYNC_THRESHOLD
    };
  }

  /**
   * Check if player can enter ring based on server-authoritative calculation
   */
  static canEnterRing(
    playerId: string,
    currentPigment: PigmentVec3,
    targetPigment: PigmentVec3,
    ringRequirement: number = 0.8
  ): { canEnter: boolean; matchPercent: number; serverPigment: PigmentVec3 } {
    const serverPigment = this.processColorMixing(playerId, currentPigment, targetPigment, 0);
    const matchPercent = calcMatchPercent(serverPigment, targetPigment);
    
    return {
      canEnter: matchPercent >= ringRequirement,
      matchPercent,
      serverPigment
    };
  }

  /**
   * Lenient ring entry validation
   */
  static lenientRingEntry(
    playerId: string,
    clientMatchPercent: number,
    serverMatchPercent: number,
    ringRequirement: number = 0.8
  ): { canEnter: boolean; useServerValue: boolean; reason: string } {
    const lenientThreshold = 0.03; // 3% leniency
    const difference = Math.abs(clientMatchPercent - serverMatchPercent);
    
    // If client is close enough and meets requirement, allow it
    if (difference <= lenientThreshold && clientMatchPercent >= ringRequirement) {
      return {
        canEnter: true,
        useServerValue: false,
        reason: 'Client within lenient threshold and meets requirement'
      };
    }
    
    // If server says yes but client is close, allow with server correction
    if (serverMatchPercent >= ringRequirement && difference <= lenientThreshold * 2) {
      return {
        canEnter: true,
        useServerValue: true,
        reason: 'Server confirms entry, client close enough for correction'
      };
    }
    
    // Use server authoritative decision
    return {
      canEnter: serverMatchPercent >= ringRequirement,
      useServerValue: true,
      reason: 'Server authoritative decision'
    };
  }

  /**
   * Generate color sync event for client
   */
  static generateColorSync(
    playerId: string,
    serverPigment: PigmentVec3,
    forceSync: boolean = false
  ): {
    type: 'colorSync';
    playerId: string;
    pigment: PigmentVec3;
    timestamp: number;
    forceSync: boolean;
  } {
    return {
      type: 'colorSync',
      playerId,
      pigment: serverPigment,
      timestamp: Date.now(),
      forceSync
    };
  }

  /**
   * Check if color sync is needed
   */
  static needsColorSync(
    playerId: string,
    lastSyncTime: number,
    currentPigment: PigmentVec3,
    previousPigment: PigmentVec3
  ): boolean {
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTime;
    
    // Sync based on time frequency
    if (timeSinceLastSync >= this.SYNC_FREQUENCY) {
      return true;
    }
    
    // Sync if significant color change occurred
    const colorChange = Math.abs(
      (currentPigment.r - previousPigment.r) +
      (currentPigment.g - previousPigment.g) +
      (currentPigment.b - previousPigment.b)
    );
    
    return colorChange > 0.1; // 10% total color change threshold
  }

  /**
   * Process food consumption with server-authoritative color mixing
   */
  static processFoodConsumption(
    playerId: string,
    playerPigment: PigmentVec3,
    foodPigment: PigmentVec3,
    playerSize: number,
    foodSize: number
  ): {
    newPigment: PigmentVec3;
    matchPercent: number;
    needsSync: boolean;
  } {
    // Calculate mix ratio based on size difference
    const sizeRatio = foodSize / (playerSize + foodSize);
    const mixRatio = Math.min(0.2, sizeRatio * 0.5); // Cap at 20% per food
    
    // Server-authoritative mixing
    const newPigment = this.processColorMixing(playerId, playerPigment, foodPigment, mixRatio);
    
    // Calculate match percentage
    const matchPercent = calcMatchPercent(newPigment, playerPigment);
    
    // Check if sync is needed
    const needsSync = this.needsColorSync(playerId, Date.now() - this.SYNC_FREQUENCY, newPigment, playerPigment);
    
    return {
      newPigment,
      matchPercent,
      needsSync
    };
  }

  /**
   * Validate and correct client color state
   */
  static validateAndCorrectColor(
    playerId: string,
    clientPigment: PigmentVec3,
    serverPigment: PigmentVec3
  ): {
    corrected: boolean;
    finalPigment: PigmentVec3;
    correctionReason?: string;
  } {
    const validation = this.validateClientColor(playerId, clientPigment, serverPigment);
    
    if (!validation.isValid) {
      return {
        corrected: true,
        finalPigment: serverPigment,
        correctionReason: `Desync detected: ${(validation.matchPercent * 100).toFixed(1)}% match`
      };
    }
    
    return {
      corrected: false,
      finalPigment: clientPigment
    };
  }

  /**
   * Get color mixing statistics
   */
  static getColorMixingStats(): {
    totalMixes: number;
    averageDesync: number;
    correctionRate: number;
  } {
    // In a real implementation, this would track actual statistics
    return {
      totalMixes: 0,
      averageDesync: 0,
      correctionRate: 0
    };
  }
}

export const colorMixingSystem = ColorMixingSystem;
