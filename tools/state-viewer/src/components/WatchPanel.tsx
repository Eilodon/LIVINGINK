import { useState } from 'react';
import { EntitySnapshot } from '../hooks/useStateSnapshot';

interface Watch {
  id: string;
  entityIndex: number;
  path: string;
  value: unknown;
}

interface WatchPanelProps {
  watches: Watch[];
  entities: EntitySnapshot[];
  onAddWatch: (entityIndex: number, path: string) => void;
  onRemoveWatch: (id: string) => void;
  onClearAll: () => void;
}

export function WatchPanel({ watches, entities, onAddWatch, onRemoveWatch, onClearAll }: WatchPanelProps) {
  const [selectedEntity, setSelectedEntity] = useState<number | ''>('');
  const [selectedProperty, setSelectedProperty] = useState('');

  const getWatchValue = (watch: Watch): string => {
    const entity = entities.find(e => e.index === watch.entityIndex);
    if (!entity) return 'N/A';
    
    const parts = watch.path.split('.');
    let value: unknown = entity;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return 'N/A';
      }
    }
    
    if (typeof value === 'number') return value.toFixed(2);
    return String(value);
  };

  const handleAdd = () => {
    if (selectedEntity !== '' && selectedProperty) {
      onAddWatch(Number(selectedEntity), selectedProperty);
      setSelectedProperty('');
    }
  };

  return (
    <div className="watch-panel">
      <h3>🔍 Watch Panel</h3>
      
      <div className="watch-add">
        <select value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value === '' ? '' : Number(e.target.value))} title="Select entity">
          <option value="">Select Entity</option>
          {entities.map(e => (
            <option key={e.index} value={e.index}>#{e.index} ({e.type})</option>
          ))}
        </select>
        
        <select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)} title="Select property">
          <option value="">Select Property</option>
          <optgroup label="Transform">
            <option value="transform.x">x</option>
            <option value="transform.y">y</option>
            <option value="transform.rotation">rotation</option>
          </optgroup>
          <optgroup label="Physics">
            <option value="physics.vx">vx</option>
            <option value="physics.vy">vy</option>
          </optgroup>
          <optgroup label="Stats">
            <option value="stats.health">health</option>
            <option value="stats.score">score</option>
            <option value="stats.matchPercent">matchPercent</option>
          </optgroup>
        </select>
        
        <button onClick={handleAdd}>Add</button>
      </div>

      <div className="watch-list">
        {watches.length === 0 ? (
          <p className="empty">No watches added</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Property</th>
                <th>Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {watches.map(watch => (
                <tr key={watch.id}>
                  <td>#{watch.entityIndex}</td>
                  <td>{watch.path}</td>
                  <td className="value">{getWatchValue(watch)}</td>
                  <td>
                    <button onClick={() => onRemoveWatch(watch.id)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {watches.length > 0 && (
        <button className="clear-btn" onClick={onClearAll}>Clear All</button>
      )}
    </div>
  );
}
