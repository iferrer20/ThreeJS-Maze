import type { BoardShadows } from './board-shadows';
import { type BufferGeometry, Group, Mesh as ThreeMesh, WireframeGeometry, type Vector3 } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { mat4 } from './core';
import { createSurfaceMaterial, type Surface } from './shaders';

export class Mesh {
  readonly object = new Group();
  private readonly solid: ThreeMesh<BufferGeometry, ReturnType<typeof createSurfaceMaterial>>;
  private lines?: LineSegments2;

  constructor(geometry: BufferGeometry, shader: Surface) {
    this.solid = new ThreeMesh(geometry, createSurfaceMaterial(shader));
    this.object.matrixAutoUpdate = false;
    this.object.add(this.solid);
  }

  sync(model: mat4, wireframe: boolean, lightPosition: Vector3, shadows: BoardShadows) {
    const uniforms = this.solid.material.uniforms;
    uniforms.lightPos.value = lightPosition;
    uniforms.shadowMap.value = shadows.depth;
    uniforms.shadowMatrix.value = shadows.matrix;
    uniforms.shadowLightPosition.value = shadows.lightPosition;
    uniforms.contactSphere.value = shadows.contactSphere;
    this.object.matrix.fromArray(model);
    this.object.matrixWorldNeedsUpdate = true;
    this.solid.visible = !wireframe;

    if (wireframe && !this.lines) {
      const edges = new WireframeGeometry(this.solid.geometry);
      const geometry = new LineSegmentsGeometry().fromWireframeGeometry(edges);
      edges.dispose();
      const material = new LineMaterial({ color: 0xb8ebff, linewidth: 1.5 });
      this.lines = new LineSegments2(geometry, material);
      this.object.add(this.lines);
    }
    if (this.lines) this.lines.visible = wireframe;
  }

  dispose() {
    this.object.removeFromParent();
    this.solid.geometry.dispose();
    this.solid.material.dispose();
    this.lines?.geometry.dispose();
    this.lines?.material.dispose();
  }
}
