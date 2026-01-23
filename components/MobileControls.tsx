
import React, { useRef, useEffect } from 'react';

interface MobileControlsProps {
  onMove: (x: number, y: number) => void;
  onAction: (btn: 'skill' | 'eject') => void;
  onActionEnd: (btn: 'skill' | 'eject') => void;
}

const MobileControls: React.FC<MobileControlsProps> = ({ onMove, onAction, onActionEnd }) => {
  const stickRef = useRef<HTMLDivElement>(null);

  // Joystick logic (simplified for MVP)
  // ...

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {/* Joystick Area */}
      <div className="absolute bottom-10 left-10 w-40 h-40 bg-white/10 rounded-full pointer-events-auto"
        onTouchMove={(e) => {
          // Calculate delta
          const touch = e.touches[0];
          // normalized -1..1
          onMove(0.5, 0.5); // Placeholder
        }}
      />

      {/* Action Buttons */}
      <div className="absolute bottom-10 right-10 flex gap-4 pointer-events-auto">
        <button
          className="w-20 h-20 bg-red-500/50 rounded-full font-bold text-white shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
          onTouchStart={() => onAction('eject')}
          onTouchEnd={() => onActionEnd('eject')}
        >
          EJECT
        </button>

        <button
          className="w-24 h-24 bg-blue-500/50 rounded-full font-bold text-white shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
          onTouchStart={() => onAction('skill')}
          onTouchEnd={() => onActionEnd('skill')}
        >
          SKILL
        </button>
      </div>
    </div>
  );
};

export default MobileControls;
