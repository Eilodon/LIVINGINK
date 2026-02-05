/**
 * Network Sync (Fix #5: Split GOD Object)
 * =============================================================================
 * Handles network synchronization between client and server.
 * Extracted from GameStateManager to reduce god object complexity.
 * =============================================================================
 */

import { NetworkClient, NetworkStatus } from '../../../network/NetworkClient';
import { GameState } from '../../../types';
import { clientLogger } from '../../../core/logging/ClientLogger';
import { getCurrentEngine } from '../context';

export interface NetworkSyncConfig {
  interpolationDelayMs: number;
  maxReconciliationDistance: number;
}

const DEFAULT_CONFIG: NetworkSyncConfig = {
  interpolationDelayMs: 100,
  maxReconciliationDistance: 10,
};

export class NetworkSync {
  private config: NetworkSyncConfig;
  private lastNetworkStatus: NetworkStatus = 'offline';
  private statusListener?: (status: NetworkStatus) => void;

  constructor(
    private readonly networkClient: NetworkClient,
    config: Partial<NetworkSyncConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize network sync and set up listeners
   */
  public initialize(state: GameState): void {
    this.networkClient.setLocalState(state);
    this.networkClient.setStatusListener((status) => {
      this.lastNetworkStatus = status;
      if (this.statusListener) {
        this.statusListener(status);
      }
    });
  }

  /**
   * Connect to multiplayer server
   */
  public async connect(name: string, shape: string): Promise<boolean> {
    clientLogger.info('Connecting to multiplayer...', { name, shape });
    return this.networkClient.connectWithRetry(name, shape as any);
  }

  /**
   * Disconnect from server
   */
  public disconnect(): void {
    this.networkClient.disconnect();
  }

  /**
   * Send player input to server
   */
  public sendInput(
    targetX: number,
    targetY: number,
    actions: { space: boolean; w: boolean },
    dt: number
  ): void {
    const engine = getCurrentEngine();
    if (!engine) return;

    this.networkClient.sendInput(
      { x: targetX, y: targetY },
      actions,
      dt
    );
  }

  /**
   * Update network interpolation state
   * Call this every frame to interpolate remote player positions
   */
  public update(state: GameState, dt: number): void {
    // NetworkClient handles interpolation internally via interpolateState
    this.networkClient.interpolateState(state, performance.now());
  }

  /**
   * Get current network status
   */
  public getStatus(): NetworkStatus {
    return this.lastNetworkStatus;
  }

  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this.lastNetworkStatus === 'online';
  }

  /**
   * Set status change listener
   */
  public setStatusListener(listener: (status: NetworkStatus) => void): void {
    this.statusListener = listener;
  }

  /**
   * Get network statistics
   */
  public getStats(): {
    ping: number;
    packetLoss: number;
    status: NetworkStatus;
  } {
    // Placeholder - would integrate with actual network stats
    return {
      ping: 0,
      packetLoss: 0,
      status: this.lastNetworkStatus,
    };
  }
}

// Export singleton instance
export const networkSync = new NetworkSync(new NetworkClient());
