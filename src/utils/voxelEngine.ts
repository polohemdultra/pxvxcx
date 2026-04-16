import { Pixel, Voxel, ObjectGroup, GridSize } from '../types';

export interface MeshBox {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  colorId: string;
}

/**
 * VoxelEngine
 * 
 * High-performance logic for converting 2D layered pixel data into a 3D voxel model.
 * Uses Typed Arrays for fast spatial lookups and Greedy Meshing to reduce geometry complexity.
 */
export class VoxelEngine {
  /**
   * Converts pixels to MeshBoxes using a Greedy Meshing approach.
   * This significantly reduces the number of draw calls and vertices.
   */
  static pixelsToMeshBoxes(
    pixels: Pixel[], 
    gridSize: GridSize, 
    totalLayers: number,
    center: boolean = true
  ): MeshBox[] {
    if (pixels.length === 0) return [];

    const offsetX = center ? gridSize / 2 : 0;
    const offsetZ = center ? gridSize / 2 : 0;
    const offsetY = center ? totalLayers / 2 : 0;

    // 1. Create a 3D grid using a Typed Array for O(1) lookups
    // We store the color index or a reference. For simplicity, let's map colors to IDs.
    const colorPalette = Array.from(new Set(pixels.map(p => p.colorId)));
    const colorToIndex = new Map(colorPalette.map((c, i) => [c, i + 1])); // 0 is empty
    
    // Grid dimensions: gridSize x totalLayers x gridSize
    const grid = new Int32Array(gridSize * totalLayers * gridSize);
    
    pixels.forEach(p => {
      if (p.visible) {
        const idx = (p.layerIndex * gridSize * gridSize) + (p.y * gridSize) + p.x;
        grid[idx] = colorToIndex.get(p.colorId) || 0;
      }
    });

    const meshBoxes: MeshBox[] = [];
    const visited = new Uint8Array(grid.length);

    // 2. Greedy Meshing Algorithm
    // We iterate through the grid and try to expand boxes as much as possible
    for (let l = 0; l < totalLayers; l++) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const idx = (l * gridSize * gridSize) + (y * gridSize) + x;
          
          if (grid[idx] === 0 || visited[idx]) continue;

          const colorIdx = grid[idx];
          const colorId = colorPalette[colorIdx - 1];

          // Try to expand in X
          let width = 1;
          while (x + width < gridSize) {
            const nextIdx = idx + width;
            if (grid[nextIdx] === colorIdx && !visited[nextIdx]) {
              width++;
            } else {
              break;
            }
          }

          // Try to expand in Z (which is Y in our 2D grid)
          let depth = 1;
          while (y + depth < gridSize) {
            let canExpandZ = true;
            for (let wx = 0; wx < width; wx++) {
              const nextZIdx = (l * gridSize * gridSize) + ((y + depth) * gridSize) + (x + wx);
              if (grid[nextZIdx] !== colorIdx || visited[nextZIdx]) {
                canExpandZ = false;
                break;
              }
            }
            if (canExpandZ) {
              depth++;
            } else {
              break;
            }
          }

          // Mark as visited
          for (let dl = 0; dl < 1; dl++) { // We currently only mesh within a layer for simplicity and coloring logic
            for (let dz = 0; dz < depth; dz++) {
              for (let dx = 0; dx < width; dx++) {
                const vIdx = (l * gridSize * gridSize) + ((y + dz) * gridSize) + (x + dx);
                visited[vIdx] = 1;
              }
            }
          }

          meshBoxes.push({
            id: `box_${x}_${l}_${y}_${width}_${depth}`,
            x: x + (width / 2) - offsetX - 0.5,
            y: l - offsetY,
            z: y + (depth / 2) - offsetZ - 0.5,
            width,
            height: 1,
            depth,
            colorId
          });
        }
      }
    }

    return meshBoxes;
  }

  /**
   * Legacy support or for cases where individual voxels are needed.
   * Optimized with Typed Arrays.
   */
  static pixelsToVoxels(
    pixels: Pixel[], 
    gridSize: GridSize, 
    totalLayers: number,
    center: boolean = true
  ): Voxel[] {
    const offsetX = center ? gridSize / 2 : 0;
    const offsetZ = center ? gridSize / 2 : 0;
    const offsetY = center ? totalLayers / 2 : 0;

    const grid = new Uint8Array(gridSize * totalLayers * gridSize);
    pixels.forEach(p => {
      if (p.visible) {
        grid[(p.layerIndex * gridSize * gridSize) + (p.y * gridSize) + p.x] = 1;
      }
    });

    const voxels: Voxel[] = [];
    
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      if (!p.visible) continue;

      const x = p.x;
      const y = p.layerIndex;
      const z = p.y;

      // Fast occlusion check using typed array
      const isHidden = 
        (x > 0 && x < gridSize - 1 && y > 0 && y < totalLayers - 1 && z > 0 && z < gridSize - 1) &&
        grid[(y * gridSize * gridSize) + (z * gridSize) + (x + 1)] &&
        grid[(y * gridSize * gridSize) + (z * gridSize) + (x - 1)] &&
        grid[((y + 1) * gridSize * gridSize) + (z * gridSize) + x] &&
        grid[((y - 1) * gridSize * gridSize) + (z * gridSize) + x] &&
        grid[(y * gridSize * gridSize) + ((z + 1) * gridSize) + x] &&
        grid[(y * gridSize * gridSize) + ((z - 1) * gridSize) + x];

      if (isHidden) continue;

      voxels.push({
        id: `v_${x}_${y}_${z}_${p.colorId}`,
        x: x - offsetX,
        y: y - offsetY,
        z: z - offsetZ,
        colorId: p.colorId
      });
    }

    return voxels;
  }

  static groupVoxelsByColor(voxels: Voxel[]): Map<string, Voxel[]> {
    const groups = new Map<string, Voxel[]>();
    voxels.forEach(voxel => {
      if (!groups.has(voxel.colorId)) groups.set(voxel.colorId, []);
      groups.get(voxel.colorId)!.push(voxel);
    });
    return groups;
  }

  static groupBoxesByColor(boxes: MeshBox[]): Map<string, MeshBox[]> {
    const groups = new Map<string, MeshBox[]>();
    boxes.forEach(box => {
      if (!groups.has(box.colorId)) groups.set(box.colorId, []);
      groups.get(box.colorId)!.push(box);
    });
    return groups;
  }

  static createObjectGroups(pixels: Pixel[]): ObjectGroup[] {
    const colorMap = new Map<string, string[]>();
    pixels.forEach(p => {
      if (!colorMap.has(p.colorId)) colorMap.set(p.colorId, []);
      colorMap.get(p.colorId)!.push(p.id);
    });

    return Array.from(colorMap.entries()).map(([colorId, pixelIds], index) => ({
      id: `group_${colorId.replace('#', '')}`,
      name: `Object ${index + 1}`,
      colorId: colorId,
      stackId: 'default',
      textureId: 'default',
      voxelIds: pixelIds
    }));
  }
}
