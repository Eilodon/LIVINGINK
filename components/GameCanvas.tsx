
import React, { useRef, useEffect } from 'react';
import { GameState, Entity, Player } from '../types';
import { MAP_RADIUS, CENTER_RADIUS, RING_RADII, WORLD_WIDTH, WORLD_HEIGHT, COLOR_PALETTE } from '../constants';

interface GameCanvasProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  width: number;
  height: number;
  onMouseMove?: (x: number, y: number) => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  enablePointerInput?: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  gameStateRef,
  width,
  height,
  onMouseMove,
  onMouseDown,
  onMouseUp,
  enablePointerInput = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Input Handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enablePointerInput) return;

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - width / 2;
      const y = e.clientY - rect.top - height / 2;
      if (onMouseMove) onMouseMove(x, y);
    };

    const handleDown = () => onMouseDown && onMouseDown();
    const handleUp = () => onMouseUp && onMouseUp();

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mousedown', handleDown);
    canvas.addEventListener('mouseup', handleUp);

    return () => {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mousedown', handleDown);
      canvas.removeEventListener('mouseup', handleUp);
    };
  }, [width, height, onMouseMove, onMouseDown, onMouseUp, enablePointerInput]);

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const gameState = gameStateRef.current;
      // Clear
      ctx.fillStyle = COLOR_PALETTE.background;
      ctx.fillRect(0, 0, width, height);

      if (!gameState?.player) {
        animationId = requestAnimationFrame(render);
        return;
      }

      // Camera
      ctx.save();
      ctx.translate(width / 2, height / 2);
      // Follow player (interpolated camera)
      ctx.translate(-gameState.camera.x, -gameState.camera.y);

      // Draw Map Boundaries
      // Outer
      ctx.strokeStyle = COLOR_PALETTE.grid;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, MAP_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Rings (CJR)
      // Ring 2 Boundary
      ctx.strokeStyle = '#3b82f6'; // Blue-ish
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, RING_RADII.R2_BOUNDARY, 0, Math.PI * 2);
      ctx.stroke();

      // Ring 3 Boundary
      ctx.strokeStyle = '#ef4444'; // Red-ish
      ctx.beginPath();
      ctx.arc(0, 0, RING_RADII.R3_BOUNDARY, 0, Math.PI * 2);
      ctx.stroke();

      const entities = [
        gameState.player,
        ...gameState.bots,
        ...gameState.food,
        ...gameState.projectiles,
      ];

      // Sorting by "z-index" generally food < player
      // Simple sort by radius usually works for top-down 2D? Or just type.
      entities.sort((a, b) => (('radius' in a ? a.radius : 0) - ('radius' in b ? b.radius : 0)));

      entities.forEach(e => {
        if (e.isDead) return;
        drawEntity(ctx, e);
      });

      // Particles
      gameState.particles.forEach(p => {
        drawParticle(ctx, p);
      });

      // Floating texts
      gameState.floatingTexts.forEach(t => {
        const alpha = Math.max(0, Math.min(1, t.life));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = t.color;
        ctx.font = `${t.size}px Sora`;
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.position.x, t.position.y);
        ctx.globalAlpha = 1;
      });

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [gameStateRef, width, height]);

  const drawEntity = (ctx: CanvasRenderingContext2D, e: Entity) => {
    ctx.save();
    ctx.translate(e.position.x, e.position.y);

    // Draw Body
    ctx.fillStyle = e.color || '#fff';

    if ('shape' in e) {
      // Player/Bot shape logic here
      // For MVP just use Circle for everyone
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();

      // Name
      if ('name' in e) {
        ctx.fillStyle = '#fff';
        ctx.font = '12px Sora';
        ctx.textAlign = 'center';
        ctx.fillText((e as Player).name, 0, -e.radius - 5);
      }
    } else {
      // Food / Projectile
      if ((e as any).kind === 'shield') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(0, -e.radius);
        ctx.lineTo(e.radius, e.radius);
        ctx.lineTo(-e.radius, e.radius);
        ctx.closePath();
        ctx.fill();
      } else if ((e as any).kind === 'catalyst') {
        ctx.fillStyle = '#d946ef';
        drawPolygon(ctx, 0, 0, e.radius, 6);
      } else if ((e as any).kind === 'solvent') {
        ctx.fillStyle = '#a5b4fc';
        ctx.fillRect(-e.radius * 0.7, -e.radius * 0.7, e.radius * 1.4, e.radius * 1.4);
      } else if ((e as any).kind === 'neutral') {
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.9, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  return <canvas ref={canvasRef} width={width} height={height} className="block" />;
};

const drawParticle = (ctx: CanvasRenderingContext2D, p: any) => {
  if (p.isIcon && p.iconSymbol) {
    ctx.globalAlpha = Math.max(0, Math.min(1, (p.fadeOut ? p.life / p.maxLife : 1)));
    ctx.fillStyle = p.iconColor || p.color || '#ffffff';
    ctx.font = `${p.fontSize || 24}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(p.iconSymbol, p.position.x, p.position.y);
    ctx.globalAlpha = 1;
    return;
  }

  const baseAlpha = p.fadeOut ? p.life / p.maxLife : 1;
  const opacity = p.bubbleOpacity ?? p.waveOpacity ?? p.auraIntensity ?? 1;
  const alpha = Math.max(0, Math.min(1, baseAlpha * opacity));
  const color =
    p.color ||
    p.rippleColor ||
    p.pulseColor ||
    p.shockwaveColor ||
    p.waveColor ||
    p.auraColor ||
    p.bubbleColor ||
    p.shieldColor ||
    p.fieldColor ||
    p.orbColor ||
    '#ffffff';

  ctx.globalAlpha = alpha;

  if (p.style === 'line') {
    const len = p.lineLength || p.radius * 2;
    const angle = p.angle || 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = p.lineWidth || 2;
    ctx.beginPath();
    ctx.moveTo(p.position.x, p.position.y);
    ctx.lineTo(
      p.position.x + Math.cos(angle) * len,
      p.position.y + Math.sin(angle) * len
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  const ringRadius =
    p.rippleRadius ||
    p.pulseRadius ||
    p.shockwaveRadius ||
    (p.isCleansingWave ? p.radius : 0);

  if (p.style === 'ring' || p.isRipple || p.isPulse || p.isShockwave || p.isCleansingWave) {
    ctx.strokeStyle = color;
    ctx.lineWidth = p.lineWidth || 2;
    ctx.beginPath();
    ctx.arc(p.position.x, p.position.y, ringRadius || p.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  const sides = p.geometricSides || (p.isHexagonShield ? 6 : 0);
  if (p.isGeometric || p.isHexagonShield || sides > 0) {
    const radius = p.geometricRadius || p.radius;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2 + (p.angle || 0);
      const px = p.position.x + Math.cos(angle) * radius;
      const py = p.position.y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (p.isHexagonShield) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.position.x, p.position.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

const drawPolygon = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, sides: number) => {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
};

export default GameCanvas;
