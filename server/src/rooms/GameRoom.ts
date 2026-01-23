
/**
 * CJR MULTIPLAYER GAME ROOM
 * Authoritative server implementation using Colyseus
 */

import { Room, Client, Delayed } from 'colyseus';
import {
  GameRoomState,
  PlayerState,
  BotState,
  FoodState,
  ProjectileState,
  PigmentVec3
} from '../schema/GameState';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAP_RADIUS,
  GRID_CELL_SIZE,
  FOOD_COUNT,
  FOOD_RADIUS
} from '../constants';
// TODO: Share factories/physics logic between client/server
// For Phase 1 compilation, we implement basic logic here or duplicate slightly
// Ideally we import from '../../../services/engine/...' but that might need Module resolution support

export class GameRoom extends Room<GameRoomState> {
  maxClients = 50;
  private gameLoop!: Delayed;

  onCreate(options: any) {
    console.log('GameRoom created!', options);
    this.setState(new GameRoomState());

    // Initialize World
    this.state.worldWidth = WORLD_WIDTH;
    this.state.worldHeight = WORLD_HEIGHT;

    // Start Game Loop (20 FPS or 60 FPS)
    this.setSimulationInterval((dt) => this.update(dt), 1000 / 20);

    // Initial Spawn
    this.spawnFoodInitial();
  }

  onJoin(client: Client, options: { name?: string; shape?: string; pigment?: any }) {
    console.log(client.sessionId, 'joined!', options);

    const player = new PlayerState();
    player.id = client.sessionId;
    player.sessionId = client.sessionId;
    player.name = options.name || `Jelly ${client.sessionId.substr(0, 4)}`;
    player.shape = options.shape || 'circle';

    // Random Position
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (MAP_RADIUS * 0.8);
    player.position.x = Math.cos(angle) * r;
    player.position.y = Math.sin(angle) * r;

    // Use provided pigment or random
    if (options.pigment) {
      player.pigment.r = options.pigment.r || Math.random();
      player.pigment.g = options.pigment.g || Math.random();
      player.pigment.b = options.pigment.b || Math.random();
    } else {
      player.pigment.r = Math.random();
      player.pigment.g = Math.random();
      player.pigment.b = Math.random();
    }

    // Target Pigment (Quest)
    player.targetPigment.r = Math.random();
    player.targetPigment.g = Math.random();
    player.targetPigment.b = Math.random();

    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, 'left!');
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log('room disposed!');
  }

  update(dt: number) {
    this.state.gameTime += dt;

    // TODO: Implement full server-side physics loop
    // Currently relying on client-side prediction + future server reconciliation
  }

  spawnFoodInitial() {
    for (let i = 0; i < 200; i++) { // Reduced for initial load
      const food = new FoodState();
      food.id = Math.random().toString(36).substr(2, 9);

      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * MAP_RADIUS;
      food.x = Math.cos(angle) * r;
      food.y = Math.sin(angle) * r;

      food.kind = 'pigment';
      food.pigment.r = Math.random();
      food.pigment.g = Math.random();
      food.pigment.b = Math.random();

      this.state.food.set(food.id, food);
    }
  }
}
