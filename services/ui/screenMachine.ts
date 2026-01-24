export type Screen = 'boot' | 'menu' | 'levelSelect' | 'playing' | 'gameOver';

export type Overlay =
  | { type: 'pause' }
  | { type: 'tutorial'; step: number }
  | { type: 'tattooPick' }
  | { type: 'settings' };

export type UiState = {
  screen: Screen;
  overlays: Overlay[];
};

export const initialUiState: UiState = {
  screen: 'boot',
  overlays: [],
};

export const pushOverlay = (state: UiState, overlay: Overlay): UiState => {
  const exists = state.overlays.some(o => o.type === overlay.type);
  if (exists) return state;
  return { ...state, overlays: [...state.overlays, overlay] };
};

export const popOverlay = (state: UiState, type?: Overlay['type']): UiState => {
  if (!type) {
    return { ...state, overlays: state.overlays.slice(0, -1) };
  }
  return { ...state, overlays: state.overlays.filter(o => o.type !== type) };
};

export const clearOverlays = (state: UiState): UiState => ({ ...state, overlays: [] });

export const topOverlay = (state: UiState): Overlay | null =>
  state.overlays.length ? state.overlays[state.overlays.length - 1] : null;

export const isInputBlocked = (state: UiState): boolean => {
  const top = topOverlay(state);
  if (!top) return false;
  return top.type !== 'tutorial';
};

