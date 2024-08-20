import { canvas, deltaTime, clamp, mat4, vec3, toRadian } from './core';
import { Game } from './game';
import { GameMap } from './levels';
import { Input } from './input';

class CameraController {
  proj = mat4.create();
  view = mat4.create();
  private tiltVelocityX = 0;
  private tiltVelocityZ = 0;
  private readonly tiltSpeed = 2.5;
  private readonly precisionTiltSpeed = 0.5;
  readonly boardRotation = mat4.create();
  rx = toRadian(90);
  ry = toRadian(90);
  private boardDistance = 20;
  private followDistance = 12;
  private followPlayer = false;
  maxZoomIn = 4;
  maxZoomOut = 60;
  pointToView = vec3.create();
  private followTarget = vec3.create();
  freeCamera = false;
  freePosition = vec3.create();
  freeYaw = 0;
  freePitch = 0;
  freeMoveSpeed = 18;
  zoomSpeed = 1.2;
  isDragging = false;

  init() {
    window.addEventListener('resize', () => this.updateProjection());
    canvas.addEventListener('pointerdown', (event) => {
      if (!this.freeCamera || event.button !== 0) return;
      if (document.pointerLockElement !== canvas) {
        const pointerLockRequest = canvas.requestPointerLock?.();
        pointerLockRequest?.catch(() => {});
      }
      this.isDragging = true;
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.freeCamera || (!this.isDragging && document.pointerLockElement !== canvas)) return;
      this.freeYaw += event.movementX * 0.003;
      this.freePitch = clamp(this.freePitch + event.movementY * 0.003, -1.5, 1.5);
    });
    canvas.addEventListener('pointerup', () => { this.isDragging = false; });
    canvas.addEventListener('pointercancel', () => { this.isDragging = false; });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? canvas.clientHeight : 1;
      const zoomFactor = Math.exp(clamp(event.deltaY * unit * 0.001, -0.3, 0.3));
      if (this.freeCamera) {
        this.zoomFreeCamera(zoomFactor);
      } else {
        this.zoomBoard(zoomFactor);
      }
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) this.isDragging = false;
    });

    this.updateInitValues();
    this.updateProjection();
  }

  updateInitValues() {
    const map = GameMap.maps[Game.level - 1];
    vec3.set(this.pointToView, (map[0].length - 1) / 2, 0, (map.length - 1) / 2);
    this.boardDistance = this.defaultZoom(false);
    this.followDistance = this.defaultZoom(true);
    this.resetTilt();
  }

  resetTilt() {
    this.rx = toRadian(90);
    this.ry = toRadian(90);
    this.tiltVelocityX = 0;
    this.tiltVelocityZ = 0;
    mat4.identity(this.boardRotation);
  }
  updateView(playerModel: mat4) {
    if (this.freeCamera) {
      this.updateFreeCamera();
      return;
    }

    const dt = clamp(deltaTime / 100, 0, 0.05);
    if (Input.keys['KeyX']) this.zoomBoard(Math.exp(this.zoomSpeed * dt));
    if (Input.keys['KeyZ']) this.zoomBoard(Math.exp(-this.zoomSpeed * dt));

    let target = this.pointToView;
    if (this.followPlayer) {
      vec3.set(this.followTarget, playerModel[12] - this.pointToView[0],
        playerModel[13] - this.pointToView[1], playerModel[14] - this.pointToView[2]);
      vec3.transformMat4(this.followTarget, this.followTarget, this.boardRotation);
      this.followTarget[1] = 0;
      target = vec3.add(this.followTarget, this.pointToView, this.followTarget);
    }
    const [x, y, z] = target;
    const distance = this.followPlayer ? this.followDistance : this.boardDistance;
    const eye = vec3.fromValues(x, y + distance, z);
    mat4.lookAt(this.view, eye, target, vec3.fromValues(0, 0, -1));
  }

  toggleFollowCamera() {
    this.followPlayer = !this.followPlayer;
  }

  resetZoom() {
    if (this.freeCamera) return;
    if (this.followPlayer) this.followDistance = this.defaultZoom(true);
    else this.boardDistance = this.defaultZoom(false);
  }

  private defaultZoom(follow: boolean) {
    const map = GameMap.maps[Game.level - 1];
    return follow
      ? Math.min(12, (map[0].length + 5) * 0.55)
      : Math.min(this.maxZoomOut, Math.max(map[0].length, map.length) + 8);
  }

  private zoomBoard(factor: number) {
    const distance = this.followPlayer ? this.followDistance : this.boardDistance;
    const nextDistance = clamp(distance * factor, this.maxZoomIn, this.maxZoomOut);
    if (this.followPlayer) this.followDistance = nextDistance;
    else this.boardDistance = nextDistance;
  }

  updateBoardTilt() {
    const dt = deltaTime / 100;
    const speed = Input.keys['ShiftLeft'] ? this.precisionTiltSpeed : this.tiltSpeed;
    const targetX = speed * Input.axis('ArrowLeft', 'ArrowRight');
    const targetZ = speed * Input.axis('ArrowUp', 'ArrowDown');
    const minTilt = toRadian(45);
    const maxTilt = toRadian(135);

    const easeTilt = (angle: number, velocity: number, target: number) => {
      const response = target === 0 ? 14 : 17;
      const blend = -Math.expm1(-response * dt);
      const nextAngle = angle + target * dt + (velocity - target) * blend / response;
      const nextVelocity = velocity + (target - velocity) * blend;
      return {
        angle: clamp(nextAngle, minTilt, maxTilt),
        velocity: nextAngle < minTilt || nextAngle > maxTilt ? 0 : nextVelocity,
      };
    };

    const x = easeTilt(this.rx, this.tiltVelocityX, targetX);
    const z = easeTilt(this.ry, this.tiltVelocityZ, targetZ);
    this.rx = x.angle;
    this.ry = z.angle;
    this.tiltVelocityX = x.velocity;
    this.tiltVelocityZ = z.velocity;
    mat4.fromZRotation(this.boardRotation, Math.PI / 2 - this.rx);
    mat4.rotateX(this.boardRotation, this.boardRotation, this.ry - Math.PI / 2);
  }

  toggleFreeCamera() {
    this.freeCamera = !this.freeCamera;
    this.isDragging = false;
    if (!this.freeCamera) {
      document.exitPointerLock?.();
      return;
    }

    const pointerLockRequest = canvas.requestPointerLock?.();
    pointerLockRequest?.catch(() => {});

    // Seed free flight from the view that was actually rendered.
    const pose = mat4.invert(mat4.create(), this.view);
    if (!pose) return;
    mat4.getTranslation(this.freePosition, pose);
    this.freeYaw = Math.atan2(-pose[8], pose[9]);
    this.freePitch = Math.asin(clamp(-pose[10], -1, 1));
  }

  updateFreeCamera() {
    const dt = clamp(deltaTime / 100, 0, 0.05);
    const forward = this.freeDirection();
    const up = vec3.fromValues(0, 0, -1);
    const right = vec3.create();
    vec3.cross(right, forward, up);
    vec3.normalize(right, right);
    const movement = vec3.create();

    if (Input.keys['KeyW']) vec3.add(movement, movement, forward);
    if (Input.keys['KeyS']) vec3.subtract(movement, movement, forward);
    if (Input.keys['KeyD']) vec3.add(movement, movement, right);
    if (Input.keys['KeyA']) vec3.subtract(movement, movement, right);
    if (Input.keys['KeyE']) vec3.add(movement, movement, up);
    if (Input.keys['KeyQ']) vec3.subtract(movement, movement, up);

    if (vec3.squaredLength(movement) > 0) {
      vec3.normalize(movement, movement);
      const map = GameMap.maps[Game.level - 1];
      const distanceToPlatform = this.distanceToPlatform();
      const mapScale = Math.max(map[0].length, map.length, 2);
      // Measure from the nearest point on the whole platform footprint, not
      // from its center, so the same precision works along every axis.
      const distanceScale = clamp(
        Math.log1p((distanceToPlatform / mapScale) * 4) / Math.log1p(4),
        0.012,
        1.5
      );
      const speed = this.freeMoveSpeed * distanceScale * (Input.keys['ShiftLeft'] ? 0.25 : 1);
      vec3.scaleAndAdd(this.freePosition, this.freePosition, movement, speed * dt);
    }

    const target = vec3.create();
    vec3.add(target, this.freePosition, forward);
    mat4.lookAt(this.view, this.freePosition, target, up);
  }

  private distanceToPlatform() {
    const map = GameMap.maps[Game.level - 1];
    const [x, y, z] = this.freePosition;
    return Math.hypot(
      x - clamp(x, -0.5, map[0].length - 0.5),
      y - clamp(y, -1.5, 0.5),
      z - clamp(z, -0.5, map.length - 0.5)
    );
  }

  zoomFreeCamera(factor: number) {
    const forward = this.freeDirection();
    const distance = clamp(this.distanceToPlatform(), 0.25, this.maxZoomOut * 2);
    const travel = distance * (1 - 1 / factor);
    vec3.scaleAndAdd(this.freePosition, this.freePosition, forward, travel);
  }
  private freeDirection() {
    const cosPitch = Math.cos(this.freePitch);
    return vec3.fromValues(
      Math.sin(this.freeYaw) * cosPitch,
      -Math.cos(this.freeYaw) * cosPitch,
      Math.sin(this.freePitch)
    );
  }

  updateProjection() {
    mat4.perspective(this.proj, toRadian(45), canvas.clientWidth / canvas.clientHeight, 0.025, 1000.0);
  }
}
export const Camera = new CameraController();
