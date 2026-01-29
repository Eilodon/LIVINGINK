// EIDOLON-V: Ring Renderer for Canvas2D
import { RING_RADII, CENTER_RADIUS, MAP_RADIUS } from '../../constants';
import { COLOR_PALETTE_HEX } from '../../constants';

export class Canvas2DRingRenderer {
  private readonly colors = {
    ...COLOR_PALETTE_HEX.rings,
    center: '#fbbf24' // Gold/amber for center zone
  };

  drawRings(ctx: CanvasRenderingContext2D, gameTime: number): void {
    // Ring 1 (Outer) - Safe Zone
    ctx.fillStyle = this.colors.r1 + '20'; // 20 = ~12% alpha
    ctx.beginPath();
    ctx.arc(0, 0, RING_RADII.R1, 0, Math.PI * 2);
    ctx.fill();

    // Ring 2 (Middle) - Danger Zone
    ctx.fillStyle = this.colors.r2 + '30';
    ctx.beginPath();
    ctx.arc(0, 0, RING_RADII.R2, 0, Math.PI * 2);
    ctx.fill();

    // Ring 3 (Inner) - Combat Zone
    ctx.fillStyle = this.colors.r3 + '40';
    ctx.beginPath();
    ctx.arc(0, 0, RING_RADII.R3, 0, Math.PI * 2);
    ctx.fill();

    // Center Zone - High Reward
    const pulse = Math.sin(gameTime * 2) * 0.1 + 0.9;
    ctx.fillStyle = this.colors.center + Math.floor(pulse * 80).toString(16).padStart(2, '0');
    ctx.beginPath();
    ctx.arc(0, 0, CENTER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Draw ring boundaries
    ctx.strokeStyle = this.colors.r1;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);

    // R1 boundary
    ctx.beginPath();
    ctx.arc(0, 0, RING_RADII.R1, 0, Math.PI * 2);
    ctx.stroke();

    // R2 boundary
    ctx.strokeStyle = this.colors.r2;
    ctx.beginPath();
    ctx.arc(0, 0, RING_RADII.R2, 0, Math.PI * 2);
    ctx.stroke();

    // R3 boundary
    ctx.strokeStyle = this.colors.r3;
    ctx.beginPath();
    ctx.arc(0, 0, RING_RADII.R3, 0, Math.PI * 2);
    ctx.stroke();

    // Center boundary
    ctx.strokeStyle = this.colors.center;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, CENTER_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
  }
}
