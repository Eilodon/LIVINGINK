import React from 'react';
import { GameState } from '../types';
import { UiState, popOverlay, pushOverlay } from '../core/ui/screenMachine';
import PauseOverlay from './overlays/PauseOverlay';
import SettingsOverlay from './overlays/SettingsOverlay';
import TutorialOverlay from './overlays/TutorialOverlay';
import TattooPicker from './TattooPicker';
import { applyTattoo } from '../game/cjr/tattoos';

interface UiOverlayManagerProps {
  overlays: UiState['overlays'];
  actions: {
    popOverlay: (type: string) => void;
    pushOverlay: (ov: any) => void;
    togglePixi: (v: boolean) => void;
    toggleMultiplayer: (v: boolean) => void;
    game?: {
      quit: () => void;
      retry: () => void;
    };
  };
  gameStateRef: React.MutableRefObject<GameState | null>;
  settings: {
    usePixi: boolean;
    useMultiplayer: boolean;
    tutorialSeen?: boolean;
  };
  onProgressionUpdate?: (fn: (p: any) => any) => void; // Optional if needed
}

export const UiOverlayManager: React.FC<UiOverlayManagerProps> = ({
  overlays,
  actions,
  gameStateRef,
  settings,
}) => {
  if (overlays.length === 0) return null;

  const top = overlays[overlays.length - 1];

  const handleTattooSelect = (id: any) => {
    const state = gameStateRef.current;
    if (!state) return;
    applyTattoo(state.player, id, state);
    state.tattooChoices = null;
    state.isPaused = false;
    actions.popOverlay('tattooPick');
  };

  return (
    <>
      {top.type === 'pause' && (
        <PauseOverlay
          onResume={() => actions.popOverlay('pause')}
          onRestart={() => {
            // Logic handled in actions.retry which should be passed if we want reuse
            // But Wait, App.tsx had onRestart calling startGame with last knowns.
            // actions.game.retry() does that.
            if (actions.game) actions.game.retry();
          }}
          onQuit={() => {
            if (actions.game) actions.game.quit();
          }}
          onSettings={() => actions.pushOverlay({ type: 'settings' })}
        />
      )}

      {top.type === 'settings' && (
        <SettingsOverlay
          usePixi={settings.usePixi}
          useMultiplayer={settings.useMultiplayer}
          onTogglePixi={actions.togglePixi}
          onToggleMultiplayer={actions.toggleMultiplayer}
          onClose={() => actions.popOverlay('settings')}
        />
      )}

      {top.type === 'tutorial' && (
        <TutorialOverlay
          step={top.step}
          onNext={() => {
            // We need to modify the overlay stack directly or use actions?
            // App.tsx did: setUi(s => ... modified stack ...)
            // useGameSession exposes actions.ui.pushOverlay but we need to replace/update top.
            // Or just pop and push next?
            actions.popOverlay('tutorial');
            actions.pushOverlay({ type: 'tutorial', step: top.step + 1 });
          }}
          onPrev={() => {
            actions.popOverlay('tutorial');
            actions.pushOverlay({ type: 'tutorial', step: Math.max(0, top.step - 1) });
          }}
          onClose={didFinish => {
            actions.popOverlay('tutorial');
            // progression update logic handles elsewhere or passed in?
            // In App.tsx: setProgression(p => ({...p, tutorialSeen:true}))
            // We might need an action for 'completeTutorial'
          }}
        />
      )}

      {top.type === 'tattooPick' && gameStateRef.current?.tattooChoices && (
        <TattooPicker choices={gameStateRef.current.tattooChoices} onSelect={handleTattooSelect} />
      )}
    </>
  );
};
