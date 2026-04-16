export type GridSize = 4 | 8 | 16 | 32 | 64;

export interface Pixel {
  id: string;
  x: number;
  y: number;
  layerIndex: number;
  colorId: string;
  visible: boolean;
  selected: boolean;
}

export interface Layer {
  id: string;
  name: string;
  index: number;
  visible: boolean;
}

export interface Voxel {
  id: string;
  x: number;
  y: number;
  z: number;
  colorId: string;
}

export interface ObjectGroup {
  id: string;
  name: string;
  colorId: string;
  stackId: string;
  textureId: string | null;
  voxelIds: string[];
}

export type TextureType = 'solid' | 'gradient' | 'tiling' | 'noise';

export interface TexturePreset {
  id: string;
  name: string;
  type: TextureType;
  intensity: number;
  roughness: number;
  metalness: number;
  dithering: boolean;
  quantize: number; // 0 = off, else levels (2-255)
  color: string;
  secondaryColor?: string;
  variant?: string; // 'linear', 'radial', 'perlin', etc.
  scale: number;
  tiling: boolean;
}

export interface LayerStack {
  id: string;
  name: string;
  gridSize: GridSize;
  layers: Layer[];
  pixels: Pixel[];
  history: Pixel[][];
  historyIndex: number;
}

export type Tool = 'pencil' | 'eraser' | 'fill' | 'rectangle' | 'triangle' | 'circle';

export type Tab = '2D' | 'Layers' | '3D' | 'Coloring';

export type ViewMode = 'solid' | 'wireframe' | 'outline';
