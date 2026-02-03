import { EntitySnapshot } from '../hooks/useStateSnapshot';

interface EntityInspectorProps {
  entity: EntitySnapshot | null;
}

export function EntityInspector({ entity }: EntityInspectorProps) {
  if (!entity) {
    return (
      <div className="entity-inspector">
        <p>Click on an entity in the world view to inspect</p>
      </div>
    );
  }

  const flags = [];
  if (entity.flags & 1) flags.push('ACTIVE');
  if (entity.flags & 2) flags.push('PLAYER');
  if (entity.flags & 4) flags.push('BOT');
  if (entity.flags & 8) flags.push('FOOD');
  if (entity.flags & 16) flags.push('DEAD');
  if (entity.flags & 32) flags.push('RING_1');
  if (entity.flags & 64) flags.push('RING_2');
  if (entity.flags & 128) flags.push('RING_3');

  return (
    <div className="entity-inspector">
      <h3>Entity #{entity.index} ({entity.type})</h3>
      
      <section>
        <h4>Transform</h4>
        <div className="prop-row">
          <span>X:</span> <code>{entity.transform.x.toFixed(2)}</code>
        </div>
        <div className="prop-row">
          <span>Y:</span> <code>{entity.transform.y.toFixed(2)}</code>
        </div>
        <div className="prop-row">
          <span>Rotation:</span> <code>{entity.transform.rotation.toFixed(2)}</code>
        </div>
        <div className="prop-row">
          <span>Scale:</span> <code>{entity.transform.scale.toFixed(2)}</code>
        </div>
      </section>

      <section>
        <h4>Physics</h4>
        <div className="prop-row">
          <span>Velocity X:</span> <code>{entity.physics.vx.toFixed(2)}</code>
        </div>
        <div className="prop-row">
          <span>Velocity Y:</span> <code>{entity.physics.vy.toFixed(2)}</code>
        </div>
        <div className="prop-row">
          <span>Mass:</span> <code>{entity.physics.mass.toFixed(2)}</code>
        </div>
        <div className="prop-row">
          <span>Radius:</span> <code>{entity.physics.radius.toFixed(2)}</code>
        </div>
      </section>

      <section>
        <h4>Stats</h4>
        <div className="prop-row">
          <span>Health:</span> 
          <code>{entity.stats.health}/{entity.stats.maxHealth}</code>
        </div>
        <div className="prop-row">
          <span>Score:</span> <code>{entity.stats.score}</code>
        </div>
        <div className="prop-row">
          <span>Match %:</span> 
          <code>{(entity.stats.matchPercent * 100).toFixed(1)}%</code>
        </div>
        {entity.ring && (
          <div className="prop-row">
            <span>Ring:</span> <code>{entity.ring}</code>
          </div>
        )}
      </section>

      <section>
        <h4>Flags</h4>
        <div className="flags">{flags.join(', ') || 'None'}</div>
      </section>
    </div>
  );
}
