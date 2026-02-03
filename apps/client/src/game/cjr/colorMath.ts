/**
 * @cjr/client - Color Math Adapter
 * 
 * EIDOLON-V REFACTOR:
 * Logic removed to prevent duplication with @cjr/engine.
 * Now simply re-exports the SSOT from the engine package.
 */

export {
  getColorHint,
  calcMatchPercent,
  calcMatchPercentFast,
  mixPigment,
  pigmentToInt,
  hexToInt,
  intToHex,
  intToRgbString,
  pigmentToHex,
  getSnapAlpha,
} from '@cjr/engine/cjr';
