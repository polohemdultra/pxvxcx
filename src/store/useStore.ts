import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { 
  GridSize, 
  Pixel, 
  Layer, 
  Tool, 
  Tab, 
  ObjectGroup, 
  TexturePreset,
  LayerStack,
  ViewMode
} from '../types';

interface AppState {
  // UI State
  activeTab: Tab;
  activeStackIndex: number;
  activeLayerIndex: number;
  selectedColor: string;
  tool: Tool;
  onionSkinning: number;
  isCrossStackOnionEnabled: boolean;
  viewMode: ViewMode;
  
  // Data State
  stacks: LayerStack[];
  objectGroups: ObjectGroup[];
  textures: TexturePreset[];
  referenceImage: {
    data: string | null;
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };

  // Actions
  setActiveTab: (tab: Tab) => void;
  setActiveStackIndex: (index: number) => void;
  addStack: (gridSize?: GridSize) => void;
  setViewMode: (mode: ViewMode) => void;
  cycleViewMode: () => void;
  setGridSize: (size: GridSize) => void;
  setActiveLayerIndex: (index: number) => void;
  setSelectedColor: (color: string) => void;
  setTool: (tool: Tool) => void;
  setOnionSkinning: (layers: number) => void;
  toggleCrossStackOnion: () => void;
  setReferenceImage: (image: string | null) => void;
  updateReferenceImage: (updates: Partial<AppState['referenceImage']>) => void;
  
  // Pixel Actions
  addPixel: (x: number, y: number) => void;
  addPixels: (points: { x: number, y: number }[]) => void;
  removePixel: (x: number, y: number) => void;
  clearLayer: () => void;
  floodFill: (x: number, y: number) => void;
  
  // Layer Actions
  addLayer: () => void;
  removeLayer: (id: string) => void;
  reorderLayers: (startIndex: number, endIndex: number) => void;
  renameLayer: (id: string, name: string) => void;
  toggleLayerVisibility: (id: string) => void;

  // Object/Coloring Actions
  updateObjectGroups: () => void;
  updateObjectGroupName: (id: string, name: string) => void;
  addTexturePreset: (preset: Omit<TexturePreset, 'id'>) => string;
  updateTexturePreset: (id: string, preset: Partial<TexturePreset>) => void;
  applyTextureToObject: (objectId: string, textureId: string | null) => void;
  
  // History Actions
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
}

const DEFAULT_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF'];

export const useStore = create<AppState>((set, get) => ({
  activeTab: '2D',
  activeStackIndex: 0,
  activeLayerIndex: 0,
  selectedColor: DEFAULT_COLORS[0],
  tool: 'pencil',
  onionSkinning: 1,
  isCrossStackOnionEnabled: true,
  viewMode: 'solid',
  
  stacks: [
    {
      id: uuidv4(),
      name: 'Base Stack',
      gridSize: 16,
      layers: [{ id: uuidv4(), name: 'Layer 1', index: 0, visible: true }],
      pixels: [],
      history: [[]],
      historyIndex: 0
    }
  ],
  objectGroups: [],
  textures: [
    { 
      id: 'default-solid', 
      name: 'Pure White', 
      type: 'solid', 
      intensity: 1, 
      roughness: 0.5, 
      metalness: 0, 
      dithering: false, 
      quantize: 0, 
      color: '#ffffff',
      scale: 1,
      tiling: true
    }
  ],
  referenceImage: {
    data: null,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
  },
  
  history: [[]],
  historyIndex: 0,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveStackIndex: (index) => set({ activeStackIndex: index, activeLayerIndex: 0 }),
  addStack: (gridSize = 32) => {
    set((state) => {
      const newStack: LayerStack = {
        id: uuidv4(),
        name: `Stack ${state.stacks.length + 1}`,
        gridSize,
        layers: [{ id: uuidv4(), name: 'Layer 1', index: 0, visible: true }],
        pixels: [],
        history: [[]],
        historyIndex: 0
      };
      return {
        stacks: [...state.stacks, newStack],
        activeStackIndex: state.stacks.length,
        activeLayerIndex: 0
      };
    });
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  cycleViewMode: () => set((state) => {
    const modes: ViewMode[] = ['solid', 'wireframe', 'outline'];
    const nextIndex = (modes.indexOf(state.viewMode) + 1) % modes.length;
    return { viewMode: modes[nextIndex] };
  }),
  setGridSize: (size) => {
    set((state) => {
      const stack = state.stacks[state.activeStackIndex];
      const oldSize = stack.gridSize;
      if (oldSize === size) return state;

      const diff = Math.floor((size - oldSize) / 2);
      
      const newPixels = stack.pixels
        .map(p => ({
          ...p,
          x: p.x + diff,
          y: p.y + diff
        }))
        .filter(p => p.x >= 0 && p.x < size && p.y >= 0 && p.y < size);

      const newStacks = [...state.stacks];
      newStacks[state.activeStackIndex] = { ...stack, gridSize: size, pixels: newPixels };

      return { stacks: newStacks };
    });
    get().saveHistory();
  },
  setActiveLayerIndex: (index) => set({ activeLayerIndex: index }),
  setSelectedColor: (color) => set({ selectedColor: color }),
  setTool: (tool) => set({ tool }),
  setOnionSkinning: (layers) => set({ onionSkinning: layers }),
  toggleCrossStackOnion: () => set((state) => ({ isCrossStackOnionEnabled: !state.isCrossStackOnionEnabled })),
  setReferenceImage: (data) => set((state) => ({ 
    referenceImage: { 
      data,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0
    } 
  })),
  updateReferenceImage: (updates) => set((state) => ({ 
    referenceImage: { ...state.referenceImage, ...updates } 
  })),

  saveHistory: () => {
    set((state) => {
      const stack = state.stacks[state.activeStackIndex];
      const newHistory = stack.history.slice(0, stack.historyIndex + 1);
      newHistory.push([...stack.pixels]);
      
      const newStacks = [...state.stacks];
      newStacks[state.activeStackIndex] = {
        ...stack,
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
      
      return { stacks: newStacks };
    });
    get().updateObjectGroups();
  },

  undo: () => {
    set((state) => {
      const stack = state.stacks[state.activeStackIndex];
      if (stack.historyIndex > 0) {
        const newStacks = [...state.stacks];
        newStacks[state.activeStackIndex] = {
          ...stack,
          pixels: [...stack.history[stack.historyIndex - 1]],
          historyIndex: stack.historyIndex - 1
        };
        return { stacks: newStacks };
      }
      return state;
    });
    get().updateObjectGroups();
  },

  redo: () => {
    set((state) => {
      const stack = state.stacks[state.activeStackIndex];
      if (stack.historyIndex < stack.history.length - 1) {
        const newStacks = [...state.stacks];
        newStacks[state.activeStackIndex] = {
          ...stack,
          pixels: [...stack.history[stack.historyIndex + 1]],
          historyIndex: stack.historyIndex + 1
        };
        return { stacks: newStacks };
      }
      return state;
    });
    get().updateObjectGroups();
  },

  addPixel: (x, y) => {
    const { activeStackIndex, activeLayerIndex, selectedColor, tool } = get();
    if (tool === 'eraser') {
      get().removePixel(x, y);
      return;
    }

    set((state) => {
      const stack = state.stacks[activeStackIndex];
      const existingIndex = stack.pixels.findIndex(p => p.x === x && p.y === y && p.layerIndex === activeLayerIndex);
      
      let newPixels = [...stack.pixels];
      if (existingIndex >= 0) {
        newPixels[existingIndex] = { ...newPixels[existingIndex], colorId: selectedColor };
      } else {
        newPixels.push({
          id: uuidv4(),
          x,
          y,
          layerIndex: activeLayerIndex,
          colorId: selectedColor,
          visible: true,
          selected: false
        });
      }
      
      const newStacks = [...state.stacks];
      newStacks[activeStackIndex] = { ...stack, pixels: newPixels };
      return { stacks: newStacks };
    });
  },

  addPixels: (points) => {
    const { activeStackIndex, activeLayerIndex, selectedColor } = get();
    set((state) => {
      const stack = state.stacks[activeStackIndex];
      let newPixels = [...stack.pixels];

      points.forEach(({ x, y }) => {
        const existingIndex = newPixels.findIndex(p => p.x === x && p.y === y && p.layerIndex === activeLayerIndex);
        if (existingIndex >= 0) {
          newPixels[existingIndex] = { ...newPixels[existingIndex], colorId: selectedColor };
        } else {
          newPixels.push({
            id: uuidv4(),
            x,
            y,
            layerIndex: activeLayerIndex,
            colorId: selectedColor,
            visible: true,
            selected: false
          });
        }
      });

      const newStacks = [...state.stacks];
      newStacks[activeStackIndex] = { ...stack, pixels: newPixels };
      return { stacks: newStacks };
    });
  },

  floodFill: (startX, startY) => {
    const { activeStackIndex, activeLayerIndex, selectedColor } = get();
    const activeStack = get().stacks[activeStackIndex];
    const { pixels, gridSize } = activeStack;

    const visited = new Set<string>();
    const stack: [number, number][] = [[startX, startY]];
    
    const getPixelColor = (x: number, y: number) => {
      const p = pixels.find(p => p.x === x && p.y === y && p.layerIndex === activeLayerIndex);
      return p ? p.colorId : null;
    };

    const targetColor = getPixelColor(startX, startY);
    if (targetColor === selectedColor) return;

    const pointsToFill: { x: number, y: number }[] = [];

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;

      if (x < 0 || x >= gridSize || y < 0 || y >= gridSize || visited.has(key)) continue;
      
      const currentColor = getPixelColor(x, y);
      if (currentColor === targetColor) {
        visited.add(key);
        pointsToFill.push({ x, y });
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }

    get().addPixels(pointsToFill);
    get().saveHistory();
  },

  removePixel: (x, y) => {
    const { activeStackIndex, activeLayerIndex } = get();
    set((state) => {
      const stack = state.stacks[activeStackIndex];
      const newPixels = stack.pixels.filter(p => !(p.x === x && p.y === y && p.layerIndex === activeLayerIndex));
      const newStacks = [...state.stacks];
      newStacks[activeStackIndex] = { ...stack, pixels: newPixels };
      return { stacks: newStacks };
    });
  },

  clearLayer: () => {
    const { activeStackIndex, activeLayerIndex } = get();
    set((state) => {
      const stack = state.stacks[activeStackIndex];
      const newPixels = stack.pixels.filter(p => p.layerIndex !== activeLayerIndex);
      const newStacks = [...state.stacks];
      newStacks[activeStackIndex] = { ...stack, pixels: newPixels };
      return { stacks: newStacks };
    });
    get().saveHistory();
  },

  addLayer: () => {
    set((state) => {
      const stack = state.stacks[state.activeStackIndex];
      const newIndex = stack.layers.length;
      const newLayer = {
        id: uuidv4(),
        name: `Layer ${newIndex + 1}`,
        index: newIndex,
        visible: true
      };
      const newStacks = [...state.stacks];
      newStacks[state.activeStackIndex] = {
        ...stack,
        layers: [...stack.layers, newLayer]
      };
      return {
        stacks: newStacks,
        activeLayerIndex: newIndex
      };
    });
  },

  removeLayer: (id) => {
    set((state) => {
      const stack = state.stacks[state.activeStackIndex];
      const layerToRemove = stack.layers.find(l => l.id === id);
      if (!layerToRemove) return state;
      
      const newLayers = stack.layers
        .filter(l => l.id !== id)
        .map((l, i) => ({ ...l, index: i }));
      
      const newPixels = stack.pixels.filter(p => p.layerIndex !== layerToRemove.index);
      const adjustedPixels = newPixels.map(p => {
        if (p.layerIndex > layerToRemove.index) {
          return { ...p, layerIndex: p.layerIndex - 1 };
        }
        return p;
      });

      const newStacks = [...state.stacks];
      newStacks[state.activeStackIndex] = {
        ...stack,
        layers: newLayers,
        pixels: adjustedPixels
      };

      return {
        stacks: newStacks,
        activeLayerIndex: Math.max(0, state.activeLayerIndex - 1)
      };
    });
    get().saveHistory();
  },

  reorderLayers: (startIndex, endIndex) => {
    set((state) => {
      const stack = state.stacks[state.activeStackIndex];
      const newLayersArr = [...stack.layers];
      const [removed] = newLayersArr.splice(startIndex, 1);
      newLayersArr.splice(endIndex, 0, removed);
      
      const reindexedLayers = newLayersArr.map((l, i) => ({ ...l, index: i }));
      
      const layerMap = new Map();
      stack.layers.forEach((l, i) => layerMap.set(i, reindexedLayers.findIndex(rl => rl.id === l.id)));
      
      const newPixels = stack.pixels.map(p => ({
        ...p,
        layerIndex: layerMap.get(p.layerIndex)
      }));

      const newStacks = [...state.stacks];
      newStacks[state.activeStackIndex] = {
        ...stack,
        layers: reindexedLayers,
        pixels: newPixels
      };

      return {
        stacks: newStacks
      };
    });
    get().saveHistory();
  },

  renameLayer: (id, name) => {
    set((state) => {
      const stack = state.stacks[state.activeStackIndex];
      const newStacks = [...state.stacks];
      newStacks[state.activeStackIndex] = {
        ...stack,
        layers: stack.layers.map(l => l.id === id ? { ...l, name } : l)
      };
      return { stacks: newStacks };
    });
  },

  toggleLayerVisibility: (id) => {
    set((state) => {
      const stack = state.stacks[state.activeStackIndex];
      const newStacks = [...state.stacks];
      newStacks[state.activeStackIndex] = {
        ...stack,
        layers: stack.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l)
      };
      return { stacks: newStacks };
    });
  },

  updateObjectGroups: () => {
    const { stacks, objectGroups } = get();
    const newObjectGroups: ObjectGroup[] = [];

    stacks.forEach((stack) => {
      // Group by colorId within this specific stack
      const groupsMap = new Map<string, string[]>();
      stack.pixels.forEach(p => {
        if (!groupsMap.has(p.colorId)) groupsMap.set(p.colorId, []);
        groupsMap.get(p.colorId)!.push(p.id);
      });

      groupsMap.forEach((pixelIds, colorId) => {
        const existing = objectGroups.find(og => og.colorId === colorId && og.stackId === stack.id);
        newObjectGroups.push({
          id: existing?.id || uuidv4(),
          name: existing?.name || `${stack.name} - ${colorId}`,
          colorId,
          stackId: stack.id,
          textureId: existing?.textureId || null,
          voxelIds: pixelIds
        });
      });
    });

    set({ objectGroups: newObjectGroups });
  },

  updateObjectGroupName: (id, name) => {
    set((state) => ({
      objectGroups: state.objectGroups.map(og => og.id === id ? { ...og, name } : og)
    }));
  },

  addTexturePreset: (preset) => {
    const id = uuidv4();
    const newPreset = { ...preset, id };
    set((state) => ({
      textures: [...state.textures, newPreset]
    }));
    return id;
  },

  updateTexturePreset: (id, preset) => {
    set((state) => ({
      textures: state.textures.map(t => t.id === id ? { ...t, ...preset } : t)
    }));
  },

  applyTextureToObject: (objectId, textureId) => {
    set((state) => ({
      objectGroups: state.objectGroups.map(og => og.id === objectId ? { ...og, textureId } : og)
    }));
  }
}));
