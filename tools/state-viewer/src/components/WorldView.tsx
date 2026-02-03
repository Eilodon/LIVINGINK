import { useEffect, useRef } from 'react';
import { EntitySnapshot, GameSnapshot } from '../hooks/useStateSnapshot';

interface WorldViewProps {
  snapshot: GameSnapshot | null;
  selectedEntity: EntitySnapshot | null;
  onSelectEntity: (entity: EntitySnapshot) => void;
}

export function WorldView({ snapshot, selectedEntity, onSelectEntity }: WorldViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = canvas.width / 3500; // Map game coords to canvas

    // Draw rings
    const ringRadii = [300, 800, 1500];
    const ringColors = ['#3498db', '#2ecc71', '#e74c3c'];
    
    ringRadii.forEach((radius, i) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * scale, 0, Math.PI * 2);
      ctx.strokeStyle = ringColors[i];
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw entities
    snapshot.entities.forEach(entity => {
      const x = centerX + entity.transform.x * scale;
      const y = centerY + entity.transform.y * scale;
      const radius = entity.physics.radius * scale;

      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, radius), 0, Math.PI * 2);

      // Color based on type
      switch (entity.type) {
        case 'player':
          ctx.fillStyle = entity.index === selectedEntity?.index ? '#ffff00' : '#00ff00';
          break;
        case 'bot':
          ctx.fillStyle = '#ff8800';
          break;
        case 'food':
          ctx.fillStyle = entity.pigment 
            ? `rgb(${entity.pigment.r * 255}, ${entity.pigment.g * 255}, ${entity.pigment.b * 255})`
            : '#ffffff';
          break;
        case 'boss':
          ctx.fillStyle = '#ff0000';
          break;
        default:
          ctx.fillStyle = '#888888';
      }
      
      ctx.fill();

      // Draw velocity vector for players/bots
      if (entity.type === 'player' || entity.type === 'bot') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + entity.physics.vx * scale * 5, y + entity.physics.vy * scale * 5);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // Draw stats
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Frame: ${snapshot.frame}`, 10, 20);
    ctx.fillText(`Entities: ${snapshot.gameState.entityCount}`, 10, 35);
    ctx.fillText(`Players: ${snapshot.gameState.playerCount}`, 10, 50);
    ctx.fillText(`Time: ${snapshot.gameState.gameTime.toFixed(1)}s`, 10, 65);

  }, [snapshot, selectedEntity]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!snapshot || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = canvas.width / 3500;

    // Find clicked entity
    const clicked = snapshot.entities.find(entity => {
      const x = centerX + entity.transform.x * scale;
      const y = centerY + entity.transform.y * scale;
      const dist = Math.hypot(clickX - x, clickY - y);
      return dist < Math.max(10, entity.physics.radius * scale);
    });

    if (clicked) {
      onSelectEntity(clicked);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      onClick={handleClick}
      style={{ border: '1px solid #333', cursor: 'crosshair' }}
    />
  );
}
