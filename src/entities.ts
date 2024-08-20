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
    const tile = GameMap.maps[Game.level - 1][row]?.[column];
    if (tile === 3 && this.physics.onFloor) {
      this.onWin();
      return;
    }
    if (tile === checkpointTile && this.physics.onFloor) {
      this.checkpoint ??= vec3.create();
      vec3.set(this.checkpoint, column, floorTop, row);
    }
    this.physics.writeModel(this.model);
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
