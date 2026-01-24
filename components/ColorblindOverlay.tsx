import React, { useEffect, useRef, useState } from 'react';
import { colorblindMode, ColorblindConfig } from '../services/accessibility/ColorblindMode';
import './ColorblindOverlay.css';

interface ColorblindOverlayProps {
  enabled: boolean;
  config: ColorblindConfig;
  onConfigChange: (config: ColorblindConfig) => void;
}

const ColorblindOverlay: React.FC<ColorblindOverlayProps> = ({ 
  enabled, 
  config, 
  onConfigChange 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!enabled || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Simple pattern overlay
    const drawPatternOverlay = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (!config.showPatterns) return;

      // Draw simple pattern
      ctx.globalAlpha = 0.1 * config.intensity;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      
      // Draw grid pattern
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    drawPatternOverlay();

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawPatternOverlay();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [enabled, config]);

  const toggleColorblindMode = () => {
    onConfigChange({
      ...config,
      enabled: !config.enabled
    });
  };

  const changeColorblindType = (type: ColorblindConfig['type']) => {
    onConfigChange({
      ...config,
      type
    });
  };

  const togglePatterns = () => {
    onConfigChange({
      ...config,
      showPatterns: !config.showPatterns
    });
  };

  const toggleIcons = () => {
    onConfigChange({
      ...config,
      showIcons: !config.showIcons
    });
  };

  if (!enabled) return null;

  return (
    <>
      {/* Pattern overlay canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-40 colorblind-overlay-canvas"
      />
      
      {/* Settings toggle button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        aria-label="Colorblind settings"
      >
        🎨 Colorblind
      </button>

      {/* Settings panel */}
      {showSettings && (
        <div className="fixed top-16 right-4 z-50 bg-gray-900 text-white p-4 rounded-lg shadow-xl w-80">
          <h3 className="text-lg font-bold mb-4">Colorblind Settings</h3>
          
          {/* Colorblind type selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Type:</label>
            <select
              value={config.type}
              onChange={(e) => changeColorblindType(e.target.value as ColorblindConfig['type'])}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              aria-label="Colorblind type"
            >
              <option value="off">Off</option>
              {colorblindMode.getColorblindTypes().map(type => (
                <option key={type.type} value={type.type}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pattern toggle */}
          <div className="mb-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.showPatterns}
                onChange={togglePatterns}
                className="rounded"
                aria-label="Show patterns"
              />
              <span className="text-sm">Show Patterns</span>
            </label>
          </div>

          {/* Icon toggle */}
          <div className="mb-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.showIcons}
                onChange={toggleIcons}
                className="rounded"
                aria-label="Show icons"
              />
              <span className="text-sm">Show Icons</span>
            </label>
          </div>

          {/* Intensity slider */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Intensity: {Math.round(config.intensity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.intensity}
              onChange={(e) => onConfigChange({
                ...config,
                intensity: parseFloat(e.target.value)
              })}
              className="w-full"
              aria-label="Intensity"
            />
          </div>

          {/* Close button */}
          <button
            onClick={() => setShowSettings(false)}
            className="w-full bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
};

export default ColorblindOverlay;
