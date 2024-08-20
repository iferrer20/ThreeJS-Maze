import { BoardShadows } from './board-shadows';
import { BoxGeometry, Camera as ThreeCamera, Group, Mesh as ThreeMesh, MeshBasicMaterial,
  Scene, Vector3, WebGLRenderer } from 'three';
import { canvas, element, getTime, setDeltaTime, mat4 } from './core';
import { Game } from './game';
import { GameMap } from './levels';
import { Background } from './background';
import type { Mesh } from './objects';
import { Camera } from './camera';

interface Renderable {
  mesh: Mesh;
  model: mat4;
  radius?: number;
}

class RenderLoop {
  private renderer!: WebGLRenderer;
  private scene = new Scene();
  private camera = new ThreeCamera();
  private board = new Group();
  private collisionOverlay?: Group;
  showCollisions = false;

  setCollisionOverlay(overlay: Group) {
    this.collisionOverlay = overlay;
    this.board.add(overlay);
  }

  private boardTransform = mat4.create();
  private lightPosition = new Vector3();
  private surfaceLightPosition = new Vector3();
  private contactCenter = new Vector3();
  private lightMarker = new ThreeMesh(new BoxGeometry(0.9, 0.9, 0.9),
    new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  private shadows = new BoardShadows();

  constructor() {
    this.board.matrixAutoUpdate = false;
    this.scene.add(this.board, this.lightMarker);
  }

  private renderScene() {
    this.camera.matrix.fromArray(Camera.view).invert();
    this.camera.matrixWorldNeedsUpdate = true;
    this.camera.projectionMatrix.fromArray(Camera.proj);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();

    this.renderer.clear();
    Background.render(this.renderer, getTime());
    const pivot = Camera.pointToView;
    mat4.fromTranslation(this.boardTransform, pivot);
    mat4.multiply(this.boardTransform, this.boardTransform, Camera.boardRotation);
    mat4.translate(this.boardTransform, this.boardTransform, [-pivot[0], -pivot[1], -pivot[2]]);
    this.board.matrix.fromArray(this.boardTransform);
    this.board.matrixWorldNeedsUpdate = true;
    this.lightPosition.set(pivot[0] + 10, pivot[1] + 38, pivot[2]);
    this.surfaceLightPosition.copy(this.lightPosition).applyMatrix4(this.board.matrix);
    if (this.collisionOverlay) this.collisionOverlay.visible = this.showCollisions;
    this.shadows.contactSphere.w = 0;
    for (const { mesh, model, radius } of this.objects) {
      if (radius !== undefined) {
        this.contactCenter.set(model[12], model[13], model[14]).applyMatrix4(this.board.matrix);
        const { x, y, z } = this.contactCenter;
        this.shadows.contactSphere.set(x, y, z, radius);
      }
      if (mesh.object.parent !== this.board) this.board.add(mesh.object);
      mesh.object.visible = !this.showCollisions;
      if (!this.showCollisions) mesh.sync(model, this.wireframe, this.surfaceLightPosition, this.shadows);
    }
    this.lightMarker.visible = false;
    if (!this.showCollisions && !this.wireframe) {
      const map = GameMap.maps[Game.level - 1];
      const boardRadius = Math.hypot(map[0].length / 2, map.length / 2, 1.5);
      this.shadows.render(this.renderer, this.scene, this.lightPosition, pivot, boardRadius);
    }
    this.lightMarker.position.copy(this.lightPosition);
    this.lightMarker.visible = Camera.freeCamera && !this.showCollisions;
    this.renderer.render(this.scene, this.camera);
  }

  private updates: (() => void)[] = [];
  private objects: Renderable[] = [];
  private frames = 0;
  private lastFrame = performance.now();
  private nextSecond = getTime() + 1;
  stop = false;
  wireframe = false;
  private infoDom = element('render-info');

  private resize = () => {
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  };

  private render = (now: number) => {
    setDeltaTime(now - this.lastFrame);
    this.lastFrame = now;

    for (const update of this.updates) {
      if (this.stop) break;
      update();
    }
    if (this.stop) {
      Background.dispose();
      this.shadows.dispose();
      this.lightMarker.geometry.dispose();
      this.lightMarker.material.dispose();
      this.renderer.dispose();
      return;
    }

    this.renderScene();

    this.frames++;
    if (getTime() >= this.nextSecond) {
      this.infoDom.innerText = `FPS: ${this.frames}`;
      this.frames = 0;
      this.nextSecond = getTime() + 1;
    }
    Game.updateGameInfo();
    requestAnimationFrame(this.render);
  };

  addUpdate(update: () => void) { this.updates.push(update); }
  addObject(object: Renderable) { this.objects.push(object); }

  init() {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.autoClear = false;
    this.camera.matrixAutoUpdate = false;
    window.addEventListener('resize', this.resize);
    this.resize();
    requestAnimationFrame(this.render);
  }
}
export const Render = new RenderLoop();
