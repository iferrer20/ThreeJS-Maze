import { Box } from 'cannon-es';
import { BoxGeometry, EdgesGeometry, Group,
  LineBasicMaterial, LineSegments, SphereGeometry, WireframeGeometry } from 'three';

export class CollisionView {
  readonly object = new Group();
  private board = new Group();
  private material = new LineBasicMaterial({ color: 0x71e6ff });
  private ball: LineSegments<WireframeGeometry, LineBasicMaterial>;

  constructor(radius: number) {
    const sphere = new SphereGeometry(radius, 12, 8);
    this.ball = new LineSegments(new WireframeGeometry(sphere),
      new LineBasicMaterial({ color: 0xffcb76 }));
    sphere.dispose();
    this.object.add(this.board, this.ball);
  }

  clearBoard() {
    for (const line of [...this.board.children] as LineSegments[]) {
      line.geometry.dispose();
      line.removeFromParent();
    }
  }

  add(shape: Box, x: number, y: number, z: number) {
    const half = shape.halfExtents;
    const geometry = new BoxGeometry(half.x * 2, half.y * 2, half.z * 2);
    const line = new LineSegments(new EdgesGeometry(geometry), this.material);
    geometry.dispose();
    line.position.set(x, y, z);
    this.board.add(line);
  }

  moveBall(x: number, y: number, z: number) {
    this.ball.position.set(x, y, z);
  }

  dispose() {
    this.clearBoard();
    this.material.dispose();
    this.ball.geometry.dispose();
    this.ball.material.dispose();
    this.object.removeFromParent();
  }
}
