import { DepthTexture, Matrix4, LessEqualCompare, LinearFilter, MeshDepthMaterial, PerspectiveCamera,
  Vector3, Vector4, WebGLRenderTarget, type Scene, type WebGLRenderer } from 'three';

export const shadowResolution = 3072;

export class BoardShadows {
  readonly matrix = new Matrix4();
  readonly lightPosition = new Vector3();
  readonly contactSphere = new Vector4(0, 0, 0, 0);
  readonly depth = new DepthTexture(shadowResolution, shadowResolution);
  private target = new WebGLRenderTarget(shadowResolution, shadowResolution, {
    depthTexture: this.depth,
    stencilBuffer: false,
  });
  private camera = new PerspectiveCamera(60, 1, 15, 70);
  private material = new MeshDepthMaterial();
  private center = new Vector3();

  constructor() {
    this.camera.up.set(0, 0, -1);
    this.depth.compareFunction = LessEqualCompare;
    this.depth.minFilter = LinearFilter;
    this.depth.magFilter = LinearFilter;
  }

  render(renderer: WebGLRenderer, scene: Scene, light: Vector3, center: ArrayLike<number>, boardRadius: number) {
    this.lightPosition.copy(light);
    this.camera.position.copy(light);
    this.center.fromArray(center);
    const distance = light.distanceTo(this.center);
    // Enclose the rotating board with a sphere and fit the shadow frustum to it.
    const radius = boardRadius + 1.5;
    this.camera.fov = 2 * Math.asin(Math.min(0.95, radius / distance)) * 180 / Math.PI;
    this.camera.near = Math.max(0.5, distance - radius);
    this.camera.far = distance + radius;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.center);
    this.camera.updateMatrixWorld();
    this.matrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);

    const previousTarget = renderer.getRenderTarget();
    const previousMaterial = scene.overrideMaterial;
    scene.overrideMaterial = this.material;
    renderer.setRenderTarget(this.target);
    try {
      renderer.clear(false, true, false);
      renderer.render(scene, this.camera);
    } finally {
      scene.overrideMaterial = previousMaterial;
      renderer.setRenderTarget(previousTarget);
    }
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
  }
}
