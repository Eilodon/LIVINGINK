import React, { useRef, memo } from 'react';
import { inputManager } from '../game/input/InputManager';
import { triggerHaptic } from '../game/haptics';

const MobileControls: React.FC = memo(() => {
  const stickRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);

  // Cache layout to avoid thrashing
  const rectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);

  const updateStick = (clientX: number, clientY: number) => {
    if (!stickRef.current || !rectRef.current) return;

    // Read from cache
    const rect = rectRef.current;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const maxDist = rect.width / 2;
    const dist = Math.hypot(dx, dy);

    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    const scale = Math.min(window.innerWidth, window.innerHeight) / 2;
    inputManager.setJoystick(dx / scale, dy / scale);
  };

  const handleStart = (e: React.TouchEvent) => {
    // CACHE LAYOUT ONCE
    if (baseRef.current) {
      const r = baseRef.current.getBoundingClientRect();
      rectRef.current = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      };
    }

    const t = e.changedTouches[0];
    touchIdRef.current = t.identifier;
    updateStick(t.clientX, t.clientY);
  };

  // EIDOLON ARCHITECT: Zero-Allocation Touch Iteration
  const handleMove = (e: React.TouchEvent) => {
    if (touchIdRef.current === null) return;

    // CRITICAL: Direct TouchList iteration (no Array.from allocation)
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      if (touch.identifier === touchIdRef.current) {
        updateStick(touch.clientX, touch.clientY);
        break;
      }
    }
  };
  // EIDOLON ARCHITECT: Zero-Allocation Touch Iteration
  const handleEnd = (e: React.TouchEvent) => {
    // CRITICAL: Direct TouchList iteration (no Array.from allocation)
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      if (touch.identifier === touchIdRef.current) {
        touchIdRef.current = null;
        if (stickRef.current) stickRef.current.style.transform = `translate(0px, 0px)`;
        inputManager.setJoystick(0, 0);
        break;
      }
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-50 select-none">
      <div
        ref={baseRef}
        className="absolute bottom-8 left-8 w-40 h-40 bg-white/10 rounded-full pointer-events-auto backdrop-blur-sm border-2 border-white/20"
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
      >
        <div
          ref={stickRef}
          className="absolute top-1/2 left-1/2 w-16 h-16 -ml-8 -mt-8 bg-white rounded-full shadow-lg pointer-events-none"
        />
      </div>

      <div className="absolute bottom-8 right-8 flex gap-6 pointer-events-auto items-end">
        <button
          className="w-16 h-16 bg-red-600/80 rounded-full font-bold text-white shadow-lg backdrop-blur-sm active:scale-90 transition-transform flex items-center justify-center border-2 border-white/20"
          onTouchStart={e => {
            e.preventDefault();
            triggerHaptic('medium');
            inputManager.setButton('eject', true);
          }}
          onTouchEnd={e => {
            e.preventDefault();
            inputManager.setButton('eject', false);
          }}
        >
          <span className="text-xs">EJECT</span>
        </button>
        <button
          className="w-24 h-24 bg-blue-600/80 rounded-full font-bold text-white shadow-lg backdrop-blur-sm active:scale-90 transition-transform flex items-center justify-center border-4 border-white/20"
          onTouchStart={e => {
            e.preventDefault();
            triggerHaptic('medium');
            inputManager.setButton('skill', true);
          }}
          onTouchEnd={e => {
            e.preventDefault();
            inputManager.setButton('skill', false);
          }}
        >
          SKILL
        </button>
      </div>
    </div>
  );
});

export default MobileControls;
