import { LevelConfig } from '../types';

interface LevelListProps {
  levels: LevelConfig[];
  selectedId?: number;
  onSelect: (level: LevelConfig) => void;
}

export function LevelList({ levels, selectedId, onSelect }: LevelListProps) {
  return (
    <div className="level-list">
      <h2>Levels</h2>
      <ul>
        {levels.map(level => (
          <li
            key={level.id}
            className={selectedId === level.id ? 'selected' : ''}
            onClick={() => onSelect(level)}
          >
            <span className="level-id">{level.id}</span>
            <span className="level-name">{level.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
