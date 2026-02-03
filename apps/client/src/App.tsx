import React, { useEffect, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { useGameSession } from './hooks/useGameSession';
import { BufferedInput } from './game/input/BufferedInput';
import { ScreenManager } from './components/ScreenManager';
import { AssetLoader } from './game/AssetLoader';
import { clientLogger } from './core/logging/ClientLogger';
import { mobileOptimizer } from './game/mobile/MobileOptimizer';
import { useScreenReaderAnnouncer } from './hooks/useScreenReaderAnnouncer';
import { gameStateManager } from './game/engine/GameStateManager';

import { audioEngine } from './game/audio/AudioEngine';
// EIDOLON-V: Dev tooling
import { initLevelHotReload } from './dev/LevelHotReload';
import { PacketInterceptor } from './dev/PacketInterceptor';
import { networkClient } from './network/NetworkClient';

const App: React.FC = () => {
  const session = useGameSession();
  const [bootError, setBootError] = useState<string | null>(null);
  const { announcement } = useScreenReaderAnnouncer();

  // Initialize Systems (Asset Loader + Input + Audio + Mobile)
  useEffect(() => {
    // EIDOLON-V PHASE1: Log Lifecycle
    clientLogger.info('App component mounted');

    const boot = async () => {
      try {
        clientLogger.info('🚀 SYSTEM BOOT INITIATED');
        BufferedInput.init();
        mobileOptimizer.optimizeForMobile();
        // EIDOLON-V: Dev Tooling Init
        if (import.meta.env.DEV) {
          initLevelHotReload();
          PacketInterceptor.getInstance().install(networkClient);
        }

        // EIDOLON-V FIX: REAL LOADING (Parallel)
        // Load assets, audio, and wait for basic network handshake if needed
        await Promise.all([
          AssetLoader.init(),
          audioEngine.initialize(),
          // Optional: NetClient.connect()
        ]);

        clientLogger.info('✅ BOOT COMPLETE. ENTERING MENU.');
        session.actions.ui.setScreen('menu');
      } catch (e: any) {
        clientLogger.error('FATAL: Boot failed', undefined, e);
        setBootError(e.message || 'Unknown Boot Error');
      }
    };

    boot();

    // EIDOLON ARCHITECT: Cleanup for HMR (Hot Module Reload)
    return () => {
      gameStateManager.dispose(); // EIDOLON-V FIX: Stop game loop to prevent undead loop
      BufferedInput.getInstance().dispose();
      mobileOptimizer.cleanup();
      clientLogger.info('App component unmounting');
    };
  }, []);

  if (bootError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-red-950 text-red-200">
        <div className="text-center p-8 border border-red-500 bg-black/80">
          <h1 className="text-3xl font-bold mb-4">SYSTEM FAILURE</h1>
          <p>{bootError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell select-none relative w-full h-full bg-ink-950 overflow-hidden">
      {/* EIDOLON-V: Screen reader announcements for accessibility */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0"
      >
        {announcement}
      </div>
      <ErrorBoundary>
        <ScreenManager session={session} />
      </ErrorBoundary>
    </div>
  );
};

export default App;
