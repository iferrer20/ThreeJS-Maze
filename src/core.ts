import { glMatrix } from 'gl-matrix';
export { mat4, vec3, quat } from 'gl-matrix';

export function element(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node;
}

export const canvas = document.querySelector<HTMLCanvasElement>('#glcanvas')!;
export let deltaTime = 0;
export function setDeltaTime(milliseconds: number) {
  deltaTime = clamp(milliseconds / 10, 0, 30);
}

export const getTime = () => performance.now() / 1000;
export const { toRadian } = glMatrix;
export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
