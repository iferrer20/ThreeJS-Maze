import { checkpointTile, expandFloorTiles, subtileToBoard, levelMaps, tileSubdivisions } from './level-layouts';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { floorTop, tileTop, wallTop } from './physics';
import { mat4, vec3 } from './core';
import { Game } from './game';
import { Mesh } from './objects';

class LevelMap {
  readonly maps = levelMaps;
  model = mat4.create();
  mesh!: Mesh;

  load(): vec3 {
    this.mesh?.dispose();
    const voxels = new Map<string, { x: number; y: number; z: number; material: Material }>();
    const map = expandFloorTiles(this.maps[Game.level - 1]);
    const floorMaterial = { color: [0.72, 0.66, 0.52], luminance: 1.2 };
    const materials = {
      wall: { color: [0.65, 0.52, 0.37], luminance: 1.35 },
      wallBase: floorMaterial,
      floor: floorMaterial,
      goal: { color: [0.68, 0.77, 0.28], luminance: 1.45 },
      spawn: { color: [0.78, 0.48, 0.24], luminance: 1.3 },
      checkpoint: { color: [0.35, 0.65, 0.76], luminance: 1.3 },
    };
    type Material = keyof typeof materials;
    const addVoxel = (x: number, y: number, z: number, material: Material) => {
      voxels.set(`${x},${y},${z}`, { x, y, z, material });
    };

    let spawn: vec3 | undefined;
    for (let z = 0; z < map.length; z++) {
      for (let x = 0; x < map[z].length; x++) {
        const tile = map[z][x];
        const top = tileTop(tile);
        if (top === wallTop) {
          // Keep the original wall block and extend it one unit below.
          addVoxel(x, -1, z, 'wallBase');
          addVoxel(x, 0, z, 'wall');
        } else if (top === floorTop) {
          const material = tile === 3 ? 'goal' : tile === 4 ? 'spawn'
            : tile === checkpointTile ? 'checkpoint' : 'floor';
          addVoxel(x, -1, z, material);
          if (tile === 4) spawn = vec3.fromValues(Math.floor(x / tileSubdivisions), floorTop, Math.floor(z / tileSubdivisions));
        }
      }
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const luminance: number[] = [];
    const indices: number[] = [];
    const axes = [
      { normal: 0, u: 1, v: 2 },
      { normal: 1, u: 2, v: 0 },
      { normal: 2, u: 0, v: 1 },
    ];
    type Face = { axis: typeof axes[number]; sign: number; plane: number; material: Material; cells: Set<string> };
    const faces = new Map<string, Face>();
    for (const voxel of voxels.values()) {
      const point = [voxel.x, voxel.y, voxel.z];
      for (const axis of axes) {
        for (const sign of [-1, 1]) {
          const neighbor = [...point];
          neighbor[axis.normal] += sign;
          if (voxels.has(neighbor.join(','))) continue;

          const plane = point[axis.normal] + sign * 0.5;
          const key = `${axis.normal},${sign},${plane},${voxel.material}`;
          if (!faces.has(key)) faces.set(key, { axis, sign, plane, material: voxel.material, cells: new Set() });
          faces.get(key)!.cells.add(`${point[axis.u]},${point[axis.v]}`);
        }
      }
    }

    const emitQuad = (face: Face, u: number, v: number, width: number, height: number) => {
      const { axis, sign, plane, material } = face;
      const uMin = u - 0.5;
      const uMax = u + width - 0.5;
      const vMin = v - 0.5;
      const vMax = v + height - 0.5;
      const point = (uValue: number, vValue: number) => {
        const result = [0, 0, 0];
        result[axis.normal] = plane;
        result[axis.u] = uValue;
        result[axis.v] = vValue;
        result[0] = subtileToBoard(result[0]);
        result[2] = subtileToBoard(result[2]);
        return result;
      };
      const corners = sign > 0
        ? [point(uMin, vMin), point(uMax, vMin), point(uMax, vMax), point(uMin, vMax)]
        : [point(uMin, vMin), point(uMin, vMax), point(uMax, vMax), point(uMax, vMin)];
      const normal = [0, 0, 0];
      normal[axis.normal] = sign;
      const base = positions.length / 3;
      const color = materials[material].color;
      for (const corner of corners) {
        positions.push(...corner);
        normals.push(...normal);
        colors.push(...color);
        luminance.push(materials[material].luminance);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    for (const face of faces.values()) {
      const cells = face.cells;
      while (cells.size) {
        const [uText, vText] = cells.values().next().value!.split(',');
        const u = Number(uText);
        const v = Number(vText);
        let width = 1;
        while (cells.has(`${u + width},${v}`)) width++;
        let height = 1;
        while (true) {
          let completeRow = true;
          for (let offset = 0; offset < width; offset++) {
            if (!cells.has(`${u + offset},${v + height}`)) {
              completeRow = false;
              break;
            }
          }
          if (!completeRow) break;
          height++;
        }
        for (let du = 0; du < width; du++) {
          for (let dv = 0; dv < height; dv++) cells.delete(`${u + du},${v + dv}`);
        }
        emitQuad(face, u, v, width, height);
      }
    }

    if (!spawn) throw new Error('Level has no spawn tile.');
    const geometry = new BufferGeometry()
      .setAttribute('position', new Float32BufferAttribute(positions, 3))
      .setAttribute('normal', new Float32BufferAttribute(normals, 3))
      .setAttribute('aColor', new Float32BufferAttribute(colors, 3))
      .setAttribute('aLuminance', new Float32BufferAttribute(luminance, 1))
      .setIndex(indices);
    this.mesh = new Mesh(geometry, 'platform');
    return spawn;
  }
}
export const GameMap = new LevelMap();
