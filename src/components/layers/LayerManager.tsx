import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Eye, 
  EyeOff, 
  Edit2,
  ChevronUp,
  ChevronDown,
  Layers,
  Box
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const LayerManager: React.FC = () => {
  const { 
    stacks,
    activeStackIndex,
    setActiveStackIndex,
    addStack,
    addLayer, 
    removeLayer, 
    reorderLayers, 
    renameLayer, 
    toggleLayerVisibility,
    activeLayerIndex,
    setActiveLayerIndex
  } = useStore();

  const currentStack = stacks[activeStackIndex];
  const { layers } = currentStack;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleRename = (id: string, name: string) => {
    renameLayer(id, name);
    setEditingId(null);
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  };

  // Sort layers by index descending (top to bottom)
  const sortedLayers = [...layers].sort((a, b) => b.index - a.index);

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-bg rounded-none no-scrollbar overflow-y-auto">
      {/* Stack Selection */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">Layer Stacks</h2>
        <div className="flex flex-wrap gap-2">
          {stacks.map((stack, idx) => (
            <button
              key={stack.id}
              onClick={() => setActiveStackIndex(idx)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 border transition-all rounded-none",
                activeStackIndex === idx 
                  ? "bg-accent border-accent text-bg" 
                  : "bg-surface/50 border-border text-text-dim"
              )}
            >
              <Layers size={14} />
              <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] font-black uppercase tracking-wider">{stack.name}</span>
                <span className="text-[8px] opacity-60 font-bold">{stack.gridSize}x{stack.gridSize} Grid</span>
              </div>
            </button>
          ))}
          <button 
            onClick={() => addStack(activeStackIndex === 0 ? 32 : 16)}
            className="flex items-center gap-2 border border-dashed border-border px-3 py-2 text-text-dim hover:text-white hover:border-white transition-all rounded-none"
          >
            <Plus size={14} />
            <span className="text-[10px] font-black uppercase tracking-wider">New Stack</span>
          </button>
        </div>
      </div>

      <div className="h-px bg-border/50 my-2" />

      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">Layers in {currentStack.name}</h2>
        <button 
          onClick={addLayer}
          className="flex items-center gap-2 bg-accent text-bg px-3 py-1.5 font-bold text-[10px] uppercase tracking-widest transition-all rounded-none"
        >
          <Plus size={14} />
          Add Layer
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 no-scrollbar rounded-none">
        {sortedLayers.map((layer) => (
          <div 
            key={layer.id}
            className={cn(
              "flex items-center gap-3 p-3 border transition-all rounded-none",
              activeLayerIndex === layer.index 
                ? "bg-surface border-accent" 
                : "bg-surface/50 border-border"
            )}
            onClick={() => setActiveLayerIndex(layer.index)}
          >
            <div className="text-text-dim">
              <GripVertical size={16} />
            </div>

            <div className="flex-1 flex flex-col">
              {editingId === layer.id ? (
                <input
                  autoFocus
                  className="bg-transparent border-b border-accent outline-none text-text font-bold text-xs"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleRename(layer.id, editValue)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename(layer.id, editValue)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-bold text-xs",
                    activeLayerIndex === layer.index ? "text-text" : "text-text-dim"
                  )}>
                    {currentStack.name} // {layer.name}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); startEditing(layer.id, layer.name); }}
                    className="text-text-dim hover:text-accent"
                  >
                    <Edit2 size={10} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); reorderLayers(layer.index, Math.min(layers.length - 1, layer.index + 1)); }}
                disabled={layer.index === layers.length - 1}
                className="p-1 text-text-dim hover:text-accent disabled:opacity-10"
              >
                <ChevronUp size={16} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); reorderLayers(layer.index, Math.max(0, layer.index - 1)); }}
                disabled={layer.index === 0}
                className="p-1 text-text-dim hover:text-accent disabled:opacity-10"
              >
                <ChevronDown size={16} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                className={cn(
                  "p-1 transition-colors",
                  layer.visible ? "text-text-dim hover:text-text" : "text-accent"
                )}
              >
                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                className="p-1 text-text-dim hover:text-white"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
