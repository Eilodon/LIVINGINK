import { useState, useEffect } from 'react';
import { LevelConfig } from '../types';

interface PropertyEditorProps {
  level: LevelConfig | null;
  onChange: (level: LevelConfig) => void;
}

export function PropertyEditor({ level, onChange }: PropertyEditorProps) {
  const [localLevel, setLocalLevel] = useState<LevelConfig | null>(level);

  useEffect(() => {
    setLocalLevel(level);
  }, [level]);

  if (!localLevel) {
    return (
      <div className="property-editor">
        <p>Select a level to edit</p>
      </div>
    );
  }

  const handleChange = (path: string, value: unknown) => {
    const keys = path.split('.');
    const newLevel = { ...localLevel };
    let current: Record<string, unknown> = newLevel;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
    
    setLocalLevel(newLevel);
    onChange(newLevel);
  };

  return (
    <div className="property-editor">
      <h2>{localLevel.name}</h2>
      
      <section>
        <h3>Thresholds</h3>
        <label>
          Ring 2:
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={localLevel.thresholds.ring2}
            onChange={(e) => handleChange('thresholds.ring2', parseFloat(e.target.value))}
          />
        </label>
        <label>
          Ring 3:
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={localLevel.thresholds.ring3}
            onChange={(e) => handleChange('thresholds.ring3', parseFloat(e.target.value))}
          />
        </label>
        <label>
          Win:
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={localLevel.thresholds.win}
            onChange={(e) => handleChange('thresholds.win', parseFloat(e.target.value))}
          />
        </label>
      </section>

      <section>
        <h3>Timing</h3>
        <label>
          Win Hold (seconds):
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="10"
            value={localLevel.winHoldSeconds}
            onChange={(e) => handleChange('winHoldSeconds', parseFloat(e.target.value))}
          />
        </label>
        <label>
          Time Limit (seconds):
          <input
            type="number"
            min="30"
            max="600"
            value={localLevel.timeLimit}
            onChange={(e) => handleChange('timeLimit', parseInt(e.target.value))}
          />
        </label>
      </section>

      <section>
        <h3>Spawn Settings</h3>
        <label>
          Bot Count:
          <input
            type="number"
            min="0"
            max="50"
            value={localLevel.botCount}
            onChange={(e) => handleChange('botCount', parseInt(e.target.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={localLevel.boss.boss1Enabled}
            onChange={(e) => handleChange('boss.boss1Enabled', e.target.checked)}
          />
          Boss 1 Enabled
        </label>
      </section>
    </div>
  );
}
