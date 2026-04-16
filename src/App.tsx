import React, { useState } from 'react';
import { useStore } from './store/useStore';
import { Tab } from './types';
import { PixelCanvas } from './components/canvas/PixelCanvas';
import { LayerManager } from './components/layers/LayerManager';
import { Viewport3D } from './components/3d/Viewport3D';
import { ColoringEditor } from './components/coloring/ColoringEditor';
import { 
  Layers, 
  Box, 
  Palette, 
  Square, 
  Undo2, 
  Redo2, 
  Grid3X3,
  Eye,
  EyeOff,
  ChevronDown
} from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const { 
    activeTab, 
    setActiveTab, 
    undo, 
    redo, 
    stacks,
    activeStackIndex,
    setGridSize,
    onionSkinning,
    setOnionSkinning
  } = useStore();

  const gridSize = stacks[activeStackIndex].gridSize;

  const renderTabContent = () => {
    switch (activeTab) {
      case '2D':
        return <PixelCanvas />;
      case 'Layers':
        return <LayerManager />;
      case '3D':
        return <Viewport3D />;
      case 'Coloring':
        return <ColoringEditor />;
      default:
        return <PixelCanvas />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg text-text font-sans overflow-hidden rounded-none border border-border">
      {/* Header */}
      <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0 rounded-none">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-accent flex items-center justify-center rounded-none">
            <Box size={14} className="text-bg" />
          </div>
          <h1 className="text-[11px] font-black uppercase tracking-[0.3em] text-text">VoxelCraft</h1>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={undo} className="p-2 text-text-dim hover:text-text transition-colors rounded-none">
            <Undo2 size={16} />
          </button>
          <button onClick={redo} className="p-2 text-text-dim hover:text-text transition-colors rounded-none">
            <Redo2 size={16} />
          </button>
        </div>
      </header>

      {/* Tab Navigation - Simplified */}
      <nav className="h-12 bg-surface border-b border-border flex rounded-none">
        {(['2D', 'Layers', '3D', 'Coloring'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-none",
              activeTab === tab 
                ? "bg-accent text-bg" 
                : "text-text-dim hover:text-text"
            )}
          >
            {tab === '2D' && <Square size={12} />}
            {tab === 'Layers' && <Layers size={12} />}
            {tab === '3D' && <Box size={12} />}
            {tab === 'Coloring' && <Palette size={12} />}
            <span className="hidden sm:inline">{tab}</span>
          </button>
        ))}
      </nav>

      {/* Shared Toolbar for 2D Tab - Now above canvas */}
      {activeTab === '2D' && <Toolbar2D />}
      {activeTab === '3D' && <Toolbar3D />}

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden bg-[#050505] rounded-none">
        {renderTabContent()}
      </main>
    </div>
  );
}

const Toolbar2D: React.FC = () => {
  const { 
    stacks,
    activeStackIndex,
    setGridSize,
    onionSkinning,
    setOnionSkinning,
    isCrossStackOnionEnabled,
    toggleCrossStackOnion,
    selectedColor,
    setSelectedColor
  } = useStore();

  const gridSize = stacks[activeStackIndex].gridSize;
  const [isColorOpen, setIsColorOpen] = useState(false);
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF', '#888888', '#444444'];

  return (
    <div className="p-2 bg-surface border-b border-border flex items-center gap-3 overflow-x-auto no-scrollbar rounded-none shrink-0">
      {/* Custom Color Dropdown */}
      <div className="relative">
        <button 
          onClick={() => setIsColorOpen(!isColorOpen)}
          className="flex items-center gap-2 bg-bg border border-border px-2 py-1 rounded-none hover:border-text transition-all"
        >
          <div className="w-3 h-3 border border-white/10" style={{ backgroundColor: selectedColor }} />
          <ChevronDown size={10} className="text-text-dim" />
        </button>

        {isColorOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsColorOpen(false)} />
            <div className="absolute top-full left-0 mt-1 p-2 bg-surface border border-border z-50 grid grid-cols-5 gap-1.5 shadow-2xl min-w-[120px]">
              {colors.map(c => (
                <button
                  key={c}
                  onClick={() => { setSelectedColor(c); setIsColorOpen(false); }}
                  className={cn(
                    "w-5 h-5 border transition-all hover:scale-110",
                    selectedColor === c ? "border-white scale-110" : "border-white/10"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Grid Dropdown */}
      <div className="flex items-center gap-2 bg-bg border border-border px-2 py-1 rounded-none">
        <label className="text-[8px] font-black uppercase tracking-widest text-text-dim">Grid</label>
        <div className="relative">
          <select 
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value) as any)}
            className="bg-transparent text-text text-[9px] font-bold uppercase tracking-wider pr-4 appearance-none rounded-none outline-none cursor-pointer"
          >
            {[4, 8, 16, 32, 64].map(s => (
              <option key={s} value={s} className="bg-black text-white">{s}x{s}</option>
            ))}
          </select>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim">
            <ChevronDown size={10} />
          </div>
        </div>
      </div>

      {/* Onion Dropdown */}
      <div className="flex items-center gap-2 bg-bg border border-border px-2 py-1 rounded-none">
        <label className="text-[8px] font-black uppercase tracking-widest text-text-dim">Onion</label>
        <div className="relative">
          <select 
            value={onionSkinning}
            onChange={(e) => setOnionSkinning(Number(e.target.value))}
            className="bg-transparent text-text text-[9px] font-bold uppercase tracking-wider pr-4 appearance-none rounded-none outline-none cursor-pointer"
          >
            {[0, 1, 2, 3, 4, 5].map(v => (
              <option key={v} value={v} className="bg-black text-white">{v} Layers</option>
            ))}
          </select>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim">
            <ChevronDown size={10} />
          </div>
        </div>
      </div>

      {/* Cross Stack Onion Toggle */}
      <button
        onClick={toggleCrossStackOnion}
        className={cn(
          "px-2 py-1 border text-[8px] font-black uppercase tracking-widest transition-all rounded-none",
          isCrossStackOnionEnabled 
            ? "bg-accent text-bg border-accent" 
            : "bg-bg text-text-dim border-border hover:text-text hover:border-text"
        )}
      >
        Cross Stack: {isCrossStackOnionEnabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
};

const Toolbar3D: React.FC = () => {
  const { viewMode, cycleViewMode } = useStore();

  return (
    <div className="p-2 bg-surface border-b border-border flex items-center gap-3 overflow-x-auto no-scrollbar rounded-none shrink-0">
      <div className="flex items-center gap-2 bg-bg border border-border px-2 py-1 rounded-none">
        <label className="text-[8px] font-black uppercase tracking-widest text-text-dim">Render</label>
        <button 
          onClick={cycleViewMode}
          className="text-text text-[9px] font-bold uppercase tracking-wider rounded-none outline-none cursor-pointer hover:text-accent transition-colors"
        >
          Mode: {viewMode}
        </button>
      </div>
    </div>
  );
};
