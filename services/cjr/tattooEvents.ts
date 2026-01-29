/**
 * Tattoo Event System
 * Centralized tattoo effect handling using hook/event pattern
 */

import { TattooDefinition, getTattooById } from './tattoos';
import { Player, Bot, Food, GameState } from '../../types';
import { tattooSynergyManager } from './tattooSynergies'; // EIDOLON-V: Static import

export class TattooEventManager {
  static triggerConsume(entity: Player | Bot, food: Food, state: GameState) {
    if (!entity.tattoos) return;

    entity.tattoos.forEach(tattooId => {
      const tattoo = getTattooById(tattooId);
      if (tattoo?.onConsume) {
        tattoo.onConsume(entity, food, state);
      }
    });
  }

  static triggerHit(victim: Player | Bot, attacker: Player | Bot, state: GameState) {
    if (!victim.tattoos) return;

    victim.tattoos.forEach(tattooId => {
      const tattoo = getTattooById(tattooId);
      if (tattoo?.onHit) {
        tattoo.onHit(victim, attacker, state);
      }
    });
  }

  static triggerSkill(player: Player, state: GameState) {
    if (!player.tattoos) return;

    player.tattoos.forEach(tattooId => {
      const tattoo = getTattooById(tattooId);
      if (tattoo?.onSkill) {
        tattoo.onSkill(player, state);
      }
    });
  }

  static triggerUpdate(player: Player, dt: number, state: GameState) {
    if (!player.tattoos) return;

    player.tattoos.forEach(tattooId => {
      const tattoo = getTattooById(tattooId);
      if (tattoo?.onUpdate) {
        tattoo.onUpdate(player, dt, state);
      }
    });
  }

  /**
   * EIDOLON-V FIX: Trigger cleanup when entity is deactivated
   */
  static triggerDeactivate(entityId: string) {
    tattooSynergyManager.cleanupEntity(entityId);
  }
}
