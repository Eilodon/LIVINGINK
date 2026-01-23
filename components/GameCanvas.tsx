
import React, { useRef, useEffect } from 'react';
import { GameState, Entity, Player, Bot, Food, Projectile } from '../types';
import { MAP_RADIUS, CENTER_RADIUS, RING_RADII, WORLD_WIDTH, WORLD_HEIGHT, COLOR_PALETTE } from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  width: number;
  height: number;
  onMouseMove?: (x: number, y: number) => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  enablePointerInput?: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
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
      // Clear
      ctx.fillStyle = COLOR_PALETTE.background;
      ctx.fillRect(0, 0, width, height);

      if (!gameState.player) return;

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
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.position.x, p.position.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [gameState, width, height]);

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
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText((e as Player).name, 0, -e.radius - 5);
      }
    } else {
      // Food / Projectile
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  return <canvas ref={canvasRef} width={width} height={height} className="block" />;
};

export default GameCanvas;
