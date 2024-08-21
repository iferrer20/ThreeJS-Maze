import { SphereGeometry } from 'three';
import { mat4, vec3, deltaTime, getTime, element, canvas } from './core';
import { Camera } from './camera';
import { Input } from './input';
import { Render } from './renderer';
import { Game } from './game';
import { GameMap } from './levels';
import { Mesh } from './objects';
import { floorTop, MarblePhysics } from './physics';
import { checkpointTile } from './level-layouts';

class PlayerEntity {
  readonly radius = 0.4;
  readonly model = mat4.create();
  private spawnpoint?: vec3;
  private checkpoint?: vec3;
  private physics = new MarblePhysics(this.radius);
  mesh!: Mesh;

  init() {
    Render.setCollisionOverlay(this.physics.collisionView.object);
    this.mesh = new Mesh(new SphereGeometry(this.radius, 20, 16), 'ball');
  }

  update() {
    this.physics.update(deltaTime / 100, Camera.boardRotation,
      Input.axis('ArrowLeft', 'ArrowRight'), Input.axis('ArrowUp', 'ArrowDown'));
    const { x, y, z } = this.physics.position;
    if (y < -3) {
      this.onDie();
      return;
    }
    const column = Math.floor(x + 0.5);
    const row = Math.floor(z + 0.5);
    const map = GameMap.maps[Game.level - 1];
    const tile = map[row]?.[column];
    if (this.physics.onFloor && this.touchesGoal(map, x, z)) {
      this.onWin();
      return;
    }
    if (tile === checkpointTile && this.physics.onFloor) {
      this.checkpoint ??= vec3.create();
      vec3.set(this.checkpoint, column, floorTop, row);
    }
    this.physics.writeModel(this.model);
  }

  private touchesGoal(map: number[][], x: number, z: number) {
    const minColumn = Math.max(0, Math.ceil(x - this.radius - 0.5));
    const maxColumn = Math.min(map[0].length - 1, Math.floor(x + this.radius + 0.5));
    const minRow = Math.max(0, Math.ceil(z - this.radius - 0.5));
    const maxRow = Math.min(map.length - 1, Math.floor(z + this.radius + 0.5));
    const contactDistance = this.radius + 0.02;

    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        if (map[row][column] !== 3) continue;
        const dx = Math.max(Math.abs(x - column) - 0.5, 0);
        const dz = Math.max(Math.abs(z - row) - 0.5, 0);
        if (dx * dx + dz * dz <= contactDistance * contactDistance) return true;
      }
    }
    return false;
  }

  private onWin() {
    Game.saveWin(GameMap.maps.length);
    this.advanceLevel();
  }

  advanceLevel() {
    if (Render.stop) return;
    if (Game.level < GameMap.maps.length) {
      this.loadLevel(Game.level + 1);
    } else {
      canvas.remove();
      element('no-levels').classList.remove('hidden');
      GameMap.mesh.dispose();
      this.mesh.dispose();
      this.physics.collisionView.dispose();
      Render.stop = true;
    }
  }

  previousLevel() {
    if (!Render.stop && Game.level > 1) this.loadLevel(Game.level - 1);
  }

  private loadLevel(level: number) {
    Game.level = level;
    Camera.updateInitValues();
    this.reset(GameMap.load());
    Game.timeStart = getTime();
  }

  reset(spawn?: vec3) {
    if (spawn) {
      this.spawnpoint = spawn;
      this.checkpoint = undefined;
      this.physics.setBoard(GameMap.maps[Game.level - 1]);
    }
    if (!this.spawnpoint) throw new Error('Marble spawn point is missing.');
    const [x, y, z] = this.checkpoint ?? this.spawnpoint;
    this.physics.reset(x, y, z);
    this.physics.writeModel(this.model);
  }

  private onDie() {
    Game.deaths++;
    if (!this.checkpoint) Game.timeStart = getTime();
    Camera.resetTilt();
    this.reset();
  }
}
export const GamePlayer = new PlayerEntity();
