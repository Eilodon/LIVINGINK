import { useEffect, useRef } from 'react';
import { LevelConfig } from '../types';

interface VisualPreviewProps {
  level: LevelConfig | null;
}

export function VisualPreview({ level }: VisualPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !level) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY) - 20;

    // Draw rings
    const ring1Radius = maxRadius * 0.3;
    const ring2Radius = maxRadius * 0.6;
    const ring3Radius = maxRadius * 0.9;

    // Ring 1 (inner)
    ctx.beginPath();
    ctx.arc(centerX, centerY, ring1Radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
    ctx.fill();

    // Ring 2 (middle)
    ctx.beginPath();
    ctx.arc(centerX, centerY, ring2Radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(46, 204, 113, 0.1)';
    ctx.fill();

    // Ring 3 (outer)
    ctx.beginPath();
    ctx.arc(centerX, centerY, ring3Radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(231, 76, 60, 0.1)';
    ctx.fill();

    // Draw threshold indicators
    const ring2Threshold = level.thresholds.ring2;
    const ring3Threshold = level.thresholds.ring3;
    const winThreshold = level.thresholds.win;

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Ring 1`, centerX, centerY - 5);
    ctx.fillText(`Ring 2 (${Math.round(ring2Threshold * 100)}%)`, centerX, centerY - ring1Radius - 10);
    ctx.fillText(`Ring 3 (${Math.round(ring3Threshold * 100)}%)`, centerX, centerY - ring2Radius - 10);
    ctx.fillText(`Win (${Math.round(winThreshold * 100)}%)`, centerX, centerY - ring3Radius - 10);

    // Draw boss spawn indicators if enabled
    if (level.boss.boss1Enabled) {
      ctx.beginPath();
      ctx.arc(centerX + ring3Radius * 0.7, centerY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0000';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('B1', centerX + ring3Radius * 0.7, centerY + 4);
    }

    if (level.boss.boss2Enabled) {
      ctx.beginPath();
      ctx.arc(centerX - ring3Radius * 0.7, centerY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0000';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('B2', centerX - ring3Radius * 0.7, centerY + 4);
    }

    // Legend
    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Bots: ${level.botCount}`, 10, canvas.height - 40);
    ctx.fillText(`Time: ${level.timeLimit}s`, 10, canvas.height - 25);
    ctx.fillText(`Hold: ${level.winHoldSeconds}s`, 10, canvas.height - 10);

  }, [level]);

  if (!level) {
    return (
      <div className="visual-preview">
        <p>Select a level to preview</p>
      </div>
    );
  }

  return (
    <div className="visual-preview">
      <h3>Visual Preview</h3>
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={300}
        className="preview-canvas"
      />
    </div>
  );
}
