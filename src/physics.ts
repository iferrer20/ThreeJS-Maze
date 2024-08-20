import { CollisionView } from './collision-view';
import { Body, Box, FrictionEquation, GSSolver, Material, Sphere, Vec3, World,
  type Equation } from 'cannon-es';
import { mat4 } from './core';
import { checkpointTile, expandFloorTiles, subtileToBoard, subtileSize } from './level-layouts';

export const boardBottom = -1.5;
export const floorTop = -0.5;
export const wallTop = 0.5;

export function tileTop(tile: number) {
  if (tile === 1) return wallTop;
  if (tile === 0 || tile === 3 || tile === 4 || tile === checkpointTile) return floorTop;
  return undefined;
}

const stepSeconds = 1 / 120;
const maxSpeed = 17;
const gravityStrength = 64;
const reverseBrake = Math.exp(-7 * stepSeconds);
const pitSupportFraction = 0.35;

class MarbleContactSolver extends GSSolver {
  override addEquation(equation: Equation) {
    if (equation instanceof FrictionEquation) {
      const contactOffset = equation.bi.mass > 0 ? equation.ri : equation.rj;
      // The ball only needs grip where the surface supports it from below.
      if (contactOffset.y > -0.75 * contactOffset.length()) return;
    }
    super.addEquation(equation);
  }
}

export class MarblePhysics {
  private world = new World({
    gravity: new Vec3(0, -gravityStrength, 0),
    solver: new MarbleContactSolver(),
  });
  private surface = new Material({ friction: 0.65, restitution: 0 });
  private wallSurface = new Material({ friction: 0, restitution: 0 });
  private ground: Body[] = [];
  private tileHeights: (number | undefined)[][] = [];
  private elapsed = 0;
  private ball: Body;
  readonly collisionView: CollisionView;

  constructor(private radius: number) {
    this.collisionView = new CollisionView(radius);
    this.ball = new Body({
      mass: 0.1,
      shape: new Sphere(radius),
      material: this.surface,
      linearDamping: 0.36,
      angularDamping: 0.12,
    });
    this.world.addBody(this.ball);
  }

  setBoard(map: number[][]) {
    for (const body of this.ground) this.world.removeBody(body);
    this.ground = [];
    this.collisionView.clearBoard();
    // One collider per solid rectangle keeps long wall faces continuous.
    this.tileHeights = expandFloorTiles(map).map(row => row.map(tileTop));
    const remaining = this.tileHeights.map(row => row.slice());
    for (const [z, row] of remaining.entries()) {
      for (let x = 0; x < row.length; x++) {
        const top = row[x];
        if (top === undefined) continue;

        let width = 1;
        while (row[x + width] === top) width++;

        let depth = 1;
        while (z + depth < remaining.length) {
          const next = remaining[z + depth];
          let covered = 0;
          while (covered < width && next[x + covered] === top) covered++;
          if (covered !== width) break;
          depth++;
        }

        for (let dz = 0; dz < depth; dz++) {
          remaining[z + dz].fill(undefined, x, x + width);
        }

        const halfHeight = (top - boardBottom) / 2;
        const shape = new Box(new Vec3(width * subtileSize / 2, halfHeight, depth * subtileSize / 2));
        const position = new Vec3(subtileToBoard(x + (width - 1) / 2),
          boardBottom + halfHeight, subtileToBoard(z + (depth - 1) / 2));
        const body = new Body({
          mass: 0,
          material: top === wallTop ? this.wallSurface : this.surface,
          position, shape,
        });
        this.ground.push(body);
        this.world.addBody(body);
        this.collisionView.add(shape, position.x, position.y, position.z);
      }
    }
  }

  reset(x: number, y: number, z: number) {
    this.ball.position.set(x, y + this.radius, z);
    this.ball.quaternion.set(0, 0, 0, 1);
    this.ball.velocity.setZero();
    this.ball.angularVelocity.setZero();
    this.ball.force.setZero();
    this.ball.torque.setZero();
    this.ball.aabbNeedsUpdate = true;
    this.ball.wakeUp();
    this.elapsed = 0;
  }

  private supportPitEdge(previousY: number) {
    const { x, y, z } = this.ball.position;
    const floorHeight = floorTop + this.radius;
    const column = Math.floor((x + 0.5) / subtileSize);
    const row = Math.floor((z + 0.5) / subtileSize);
    const top = this.tileHeights[row]?.[column];
    // Only catch a marble that's still at floor height. A falling marble
    // brushing the side of a pit must keep falling.
    if (top === wallTop || previousY < floorHeight - 0.025 || y > floorHeight + 0.025) return false;
    const supportDistance = this.radius * pitSupportFraction;

    for (let rz = row - 1; rz <= row + 1; rz++) {
      for (let cx = column - 1; cx <= column + 1; cx++) {
        if (this.tileHeights[rz]?.[cx] !== floorTop) continue;
        const dx = Math.max(0, Math.abs(x - subtileToBoard(cx)) - subtileSize / 2);
        const dz = Math.max(0, Math.abs(z - subtileToBoard(rz)) - subtileSize / 2);
        if (Math.hypot(dx, dz) > supportDistance) continue;
        const lipHeight = floorHeight - 0.005;
        if (y < lipHeight && this.ball.velocity.y < 0) {
          this.ball.position.y = lipHeight;
          this.ball.velocity.y = 0;
          this.ball.aabbNeedsUpdate = true;
        }
        return true;
      }
    }
    return false;
  }

  update(dt: number, boardRotation: mat4, steerX: number, steerZ: number) {
    // Convert world-down to board coordinates using the transpose of the rotation.
    this.world.gravity.set(
      -gravityStrength * boardRotation[1],
      -gravityStrength * boardRotation[5],
      -gravityStrength * boardRotation[9],
    );
    this.elapsed += dt;
    while (this.elapsed >= stepSeconds) {
      const incomingX = this.ball.velocity.x;
      const incomingZ = this.ball.velocity.z;
      const previousY = this.ball.position.y;
      this.world.step(stepSeconds);
      const velocity = this.ball.velocity;
      const ceiling = wallTop - this.radius;
      if (this.ball.position.y >= ceiling) {
        this.ball.position.y = ceiling;
        velocity.y = Math.min(velocity.y, 0);
        this.ball.aabbNeedsUpdate = true;
      }
      const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
      if (horizontalSpeed > maxSpeed) {
        const scale = maxSpeed / horizontalSpeed;
        velocity.x *= scale;
        velocity.z *= scale;
      }
      let touchesWall = false;
      let supported = false;
      for (const { bi, bj, ni } of this.world.contacts) {
        const other = bi === this.ball ? bj : bj === this.ball ? bi : undefined;
        if (!other) continue;
        const sign = bi === this.ball ? 1 : -1;
        supported ||= sign * ni.y < -0.75;
        if (other.material !== this.wallSurface || Math.abs(ni.y) >= 0.5) continue;
        touchesWall = true;
        const length = Math.hypot(ni.x, ni.z);
        const nx = sign * ni.x / length;
        const nz = sign * ni.z / length;
        const outgoing = velocity.x * nx + velocity.z * nz;
        if (incomingX * nx + incomingZ * nz >= 0 && outgoing < 0) {
          velocity.x -= nx * outgoing;
          velocity.z -= nz * outgoing;
        }
      }
      const nearPitLip = this.supportPitEdge(previousY);
      if (supported || nearPitLip) {
        // Slow only the axis the player is actively steering against.
        if (steerX * velocity.x < 0) {
          velocity.x *= reverseBrake;
          this.ball.angularVelocity.z *= reverseBrake;
        }
        if (steerZ * velocity.z < 0) {
          velocity.z *= reverseBrake;
          this.ball.angularVelocity.x *= reverseBrake;
        }
      }
      if (touchesWall) {
        // Match spin to the remaining motion so floor friction cannot restore
        // the speed that the wall just removed.
        this.ball.angularVelocity.x = velocity.z / this.radius;
        this.ball.angularVelocity.z = -velocity.x / this.radius;
      }
      this.elapsed -= stepSeconds;
    }
  }

  get position() { return this.ball.position; }

  get onFloor() {
    return Math.abs(this.position.y - (floorTop + this.radius)) < 0.045
      && Math.abs(this.ball.velocity.y) < 0.5;
  }

  writeModel(model: mat4) {
    const { x, y, z, w } = this.ball.quaternion;
    const position = this.position;
    this.collisionView.moveBall(position.x, position.y, position.z);
    mat4.fromRotationTranslation(model, [x, y, z, w], [position.x, position.y, position.z]);
  }
}
