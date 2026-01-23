import { DANGER_THRESHOLD_RATIO, EAT_THRESHOLD_RATIO } from '../constants';

export type SizeInteraction = 'consume' | 'avoid' | 'combat';

export const getSizeInteraction = (
  ratio: number,
  predatorShielded: boolean,
  preyShielded: boolean,
  predatorCharging: boolean,
  preyCharging: boolean
): SizeInteraction => {
  if (ratio >= DANGER_THRESHOLD_RATIO && !preyShielded && !preyCharging) {
    return 'consume';
  }
  if (ratio <= EAT_THRESHOLD_RATIO && !predatorShielded && !predatorCharging) {
    return 'avoid';
  }
  return 'combat';
};
