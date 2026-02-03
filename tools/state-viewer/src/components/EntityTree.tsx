import { EntitySnapshot } from '../hooks/useStateSnapshot';

interface EntityTreeProps {
  entities: EntitySnapshot[];
  selectedEntity: EntitySnapshot | null;
  onSelectEntity: (entity: EntitySnapshot) => void;
}

export function EntityTree({ entities, selectedEntity, onSelectEntity }: EntityTreeProps) {
  const grouped = entities.reduce((acc, entity) => {
    acc[entity.type] = acc[entity.type] || [];
    acc[entity.type].push(entity);
    return acc;
  }, {} as Record<string, EntitySnapshot[]>);

  const getIcon = (type: string) => {
    switch (type) {
      case 'player': return '👤';
      case 'bot': return '🤖';
      case 'food': return '🍬';
      case 'projectile': return '▲';
      case 'boss': return '★';
      default: return '❓';
    }
  };

  const getTypeName = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1) + 's';
  };

  return (
    <div className="entity-tree">
      {Object.entries(grouped).map(([type, typeEntities]) => (
        <div key={type} className="entity-group">
          <div className="group-header">
            <span>{getIcon(type)}</span>
            <span>{getTypeName(type)} ({typeEntities.length})</span>
          </div>
          <div className="group-items">
            {typeEntities.map(entity => (
              <div
                key={entity.index}
                className={`entity-item ${selectedEntity?.index === entity.index ? 'selected' : ''}`}
                onClick={() => onSelectEntity(entity)}
              >
                <span>#{entity.index}</span>
                {entity.stats && (
                  <span className="entity-score">{Math.round(entity.stats.score)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
