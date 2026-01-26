import { RING_RADII, COLOR_PALETTE } from '../cjr/cjrConstants';

// EIDOLON-V FIX: Centralized ring rendering logic
// Eliminates code duplication between PixiGameCanvas and GameCanvas
export interface RingRenderer {
  drawRings: (context: any, time: number) => void;
}

export class Canvas2DRingRenderer implements RingRenderer {
  drawRings(ctx: CanvasRenderingContext2D, time: number) {
    // Ring 1
    ctx.strokeStyle = COLOR_PALETTE.rings.r1;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, RING_RADII.R1, 0, Math.PI * 2);
    ctx.stroke();

    // Ring 2
    ctx.strokeStyle = COLOR_PALETTE.rings.r2;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, RING_RADII.R2, 0, Math.PI * 2);
    ctx.stroke();

    // Ring 3 with pulse
    const pulse = Math.sin(time * 3) * 0.1;
    ctx.strokeStyle = COLOR_PALETTE.rings.r3;
    ctx.lineWidth = 6 + pulse * 4;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, RING_RADII.R3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }
}

export class PixiRingRenderer implements RingRenderer {
  drawRings(graphics: any, time: number) {
    graphics.clear();
    graphics.circle(0, 0, RING_RADII.R1).stroke({ width: 2, color: COLOR_PALETTE.rings.r1, alpha: 0.3 });
    graphics.circle(0, 0, RING_RADII.R2).stroke({ width: 4, color: COLOR_PALETTE.rings.r2, alpha: 0.5 });
    const pulse = Math.sin(time * 3) * 0.1;
    graphics.circle(0, 0, RING_RADII.R3).stroke({ width: 6 + pulse * 4, color: COLOR_PALETTE.rings.r3, alpha: 0.8 });
  }
}
