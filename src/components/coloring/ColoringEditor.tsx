import * as THREE from 'three';
import { cn } from '../../lib/utils';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Center, Grid } from '@react-three/drei';
import { EffectComposer, Selection, Select, Outline } from '@react-three/postprocessing';
import { useStore } from '../../store/useStore';
import { VoxelEngine, MeshBox } from '../../utils/voxelEngine';
import { Plus, Save, ChevronDown, Wand2, Settings2 } from 'lucide-react';

const MeshGroup: React.FC<{ 
  boxes: MeshBox[], 
  color: string, 
  texture: any,
  isSelected: boolean, 
  viewMode?: string,
  onSelect: () => void 
}> = ({ boxes, color, texture, isSelected, viewMode = 'solid', onSelect }) => {
  const onBeforeCompile = (shader: any) => {
    shader.uniforms.uScale = { value: texture?.scale || 1.0 };
    shader.uniforms.uTiling = { value: texture?.tiling ? 1.0 : 0.0 };
    shader.uniforms.uType = { value: texture?.type === 'solid' ? 0.0 : texture?.type === 'gradient' ? 1.0 : texture?.type === 'noise' ? 2.0 : 3.0 };
    shader.uniforms.uColorB = { value: new THREE.Color(texture?.secondaryColor || '#000000') };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vWorldPos;
      varying vec2 vUvVar;
      `
    ).replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vUvVar = uv;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vWorldPos;
      varying vec2 vUvVar;
      uniform float uScale;
      uniform float uTiling;
      uniform float uType;
      uniform vec3 uColorB;
      `
    ).replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      
      vec3 pos = mix(vec3(vUvVar, 0.0), vWorldPos, uTiling);
      pos /= max(uScale, 0.01);

      if (uType > 0.5 && uType < 1.5) { // Gradient
        float d = fract(pos.x);
        diffuseColor.rgb = mix(diffuseColor.rgb, uColorB, d);
      } else if (uType > 1.5 && uType < 2.5) { // Noise (Simple sin/cos grid)
        float n = sin(pos.x * 10.0) * cos(pos.y * 10.0) * 0.5 + 0.5;
        diffuseColor.rgb = mix(diffuseColor.rgb, uColorB, n);
      } else if (uType > 2.5) { // Tiling checkerboard
        float check = mod(floor(pos.x * 5.0) + floor(pos.y * 5.0), 2.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uColorB, check);
      }

      if (${(texture?.quantize || 0).toFixed(1)} > 0.0) {
        float q = ${(texture?.quantize || 0).toFixed(1)};
        diffuseColor.rgb = floor(diffuseColor.rgb * q + 0.5) / q;
      }
      `
    );
  };

  return (
    <Select enabled={isSelected}>
      <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        {boxes.map((box) => (
          <mesh key={box.id} position={[box.x, box.y, box.z]}>
            <boxGeometry args={[box.width + 0.01, box.height + 0.01, box.depth + 0.01]} />
            <meshStandardMaterial 
              color={texture?.color || color} 
              roughness={texture?.roughness ?? 0.5}
              metalness={texture?.metalness ?? 0}
              dithering={texture?.dithering ?? false}
              onBeforeCompile={onBeforeCompile}
              key={`${texture?.quantize}-${texture?.id}-${viewMode}-${texture?.scale}-${texture?.tiling}`} // force recompile
              wireframe={viewMode === 'wireframe'}
            />
          </mesh>
        ))}
      </group>
    </Select>
  );
};
const TexturePreview: React.FC<{ texture: any }> = ({ texture }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const scale = texture.scale || 1;
    const sWidth = width * scale;
    const sHeight = height * scale;

    if (texture.type === 'solid') {
      ctx.fillStyle = texture.color;
      ctx.fillRect(0, 0, width, height);
    } else if (texture.type === 'gradient') {
      let grad;
      if (texture.variant === 'radial') {
        grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, (width/2) * scale);
      } else {
        grad = ctx.createLinearGradient(0, 0, width * scale, 0);
      }
      grad.addColorStop(0, texture.color);
      grad.addColorStop(1, texture.secondaryColor || '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (texture.type === 'noise') {
      for (let x = 0; x < width; x += 2) {
        for (let y = 0; y < height; y += 2) {
          // Visual noise approximation with scale
          const nx = x / (20 * scale);
          const ny = y / (20 * scale);
          const val = (Math.sin(nx) * Math.cos(ny) * 0.5 + 0.5) * 255;
          ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
          if (texture.variant === 'simplex') {
             ctx.fillStyle = Math.random() > 0.5 ? texture.color : (texture.secondaryColor || '#000');
          }
          ctx.fillRect(x, y, 2, 2);
        }
      }
    } else {
      // Tiling checkboard
      const size = 10 * scale;
      for (let x = 0; x < width; x += size) {
        for (let y = 0; y < height; y += size) {
          ctx.fillStyle = (Math.floor(x/size) + Math.floor(y/size)) % 2 === 0 ? texture.color : (texture.secondaryColor || '#000');
          ctx.fillRect(x, y, size, size);
        }
      }
    }

    // Apply quantization effect on preview if needed
    if (texture.quantize > 0) {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const q = texture.quantize;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.floor(data[i] / (256/q)) * (256/q);
        data[i+1] = Math.floor(data[i+1] / (256/q)) * (256/q);
        data[i+2] = Math.floor(data[i+2] / (256/q)) * (256/q);
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }, [texture]);

  return (
    <div className="relative w-full aspect-square border border-border bg-black overflow-hidden group">
      <canvas ref={canvasRef} width={200} height={200} className="w-full h-full image-pixelated" />
      <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1 text-[7px] font-black uppercase tracking-widest text-center text-white/40">
        Live Preview
      </div>
    </div>
  );
};

export const ColoringEditor: React.FC = () => {
  const { 
    stacks,
    objectGroups, 
    textures, 
    applyTextureToObject, 
    addTexturePreset,
    updateTexturePreset,
    updateObjectGroupName,
    viewMode,
    cycleViewMode
  } = useStore();
  
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'material' | 'effects'>('material');
  
  const boxes = useMemo(() => {
    return stacks.flatMap((stack, sIdx) => {
      const stackBoxes = VoxelEngine.pixelsToMeshBoxes(stack.pixels, stack.gridSize, stack.layers.length);
      const scale = 16 / stack.gridSize;
      return stackBoxes.map(b => ({
        ...b,
        id: `stack_${sIdx}_${b.id}`,
        stackId: stack.id,
        x: b.x * scale,
        y: b.y * scale,
        z: b.z * scale,
        width: b.width * scale,
        height: b.height * scale,
        depth: b.depth * scale
      }));
    });
  }, [stacks]);
  
  const selectedGroup = objectGroups.find(og => og.id === selectedObjectId);
  const selectedTexture = textures.find(t => t.id === selectedGroup?.textureId);

  const handleUpdateTexture = (updates: any) => {
    if (selectedTexture) {
      updateTexturePreset(selectedTexture.id, updates);
    }
  };

  const handleCreateNewTexture = () => {
    if (!selectedGroup) return;
    const newId = addTexturePreset({
      name: `Material ${textures.length + 1}`,
      type: 'solid',
      intensity: 1,
      roughness: 0.5,
      metalness: 0,
      dithering: false,
      quantize: 0,
      color: selectedGroup.colorId,
      secondaryColor: '#000000',
      variant: 'linear',
      scale: 1,
      tiling: true
    });
    applyTextureToObject(selectedGroup.id, newId);
  };

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* 3D Preview (Top Half) */}
      <div className="flex-1 relative">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[16, 16, 16]} />
          <OrbitControls makeDefault />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          
          <Selection>
            <EffectComposer multisampling={8}>
              <Outline 
                visibleEdgeColor={0xffffff} 
                hiddenEdgeColor={0xffffff} 
                edgeStrength={10} 
                width={1} 
              />
            </EffectComposer>

            <Center top>
              {objectGroups.map((group) => {
                const groupBoxes = boxes.filter(b => b.colorId === group.colorId && b.stackId === group.stackId);
                const groupTexture = textures.find(t => t.id === group.textureId);
                return (
                  <MeshGroup 
                    key={group.id} 
                    boxes={groupBoxes} 
                    color={group.colorId} 
                    texture={groupTexture}
                    isSelected={selectedObjectId === group.id}
                    viewMode={viewMode}
                    onSelect={() => setSelectedObjectId(group.id)}
                  />
                );
              })}
            </Center>
          </Selection>
          
          <Grid 
            infiniteGrid 
            fadeDistance={50} 
            fadeStrength={5} 
            sectionSize={16} 
            sectionColor="#333333" 
            cellColor="#111111" 
          />
        </Canvas>
        <div className="absolute top-4 left-4 bg-surface/80 backdrop-blur-md px-3 py-1.5 border border-border text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
          <span>{selectedObjectId ? `Editing: ${selectedGroup?.name}` : 'Select Object in 3D'}</span>
          <button 
            onClick={cycleViewMode}
            className="ml-2 bg-accent text-bg px-2 py-0.5 hover:bg-white transition-colors flex items-center gap-1"
          >
            Mode: {viewMode}
          </button>
        </div>
      </div>

      {/* Coloring Controls (Bottom Half) */}
      <div className="h-[340px] bg-surface border-t border-border p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar rounded-none relative">
        {!selectedObjectId ? (
          <div className="flex-1 flex items-center justify-center border border-dashed border-border bg-bg/20">
            <p className="text-text-dim text-[10px] font-bold uppercase tracking-wider italic">Tap an object in the 3D view to start painting</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Header: Name and Texture Selector */}
            <div className="flex items-center justify-between gap-4">
              <input 
                className="bg-transparent border-b border-border outline-none text-[11px] font-black uppercase tracking-widest text-text w-1/3"
                value={selectedGroup?.name || ''}
                onChange={(e) => updateObjectGroupName(selectedGroup!.id, e.target.value)}
              />
              
              <div className="flex-1 flex gap-2 items-center justify-end">
                <div className="relative bg-bg border border-border px-2 py-1 flex items-center gap-2">
                  <select 
                    className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none pr-4 appearance-none cursor-pointer"
                    value={selectedGroup?.textureId || ''}
                    onChange={(e) => applyTextureToObject(selectedGroup!.id, e.target.value || null)}
                  >
                    <option value="">No Texture</option>
                    {textures.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={10} className="absolute right-2 text-text-dim pointer-events-none" />
                </div>
                <button 
                  onClick={handleCreateNewTexture}
                  className="p-1.5 bg-bg border border-border text-accent hover:border-accent transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {selectedTexture ? (
              <div className="flex gap-6">
                {/* Visual Preview Section */}
                <div className="w-24 shrink-0 flex flex-col gap-2">
                   <TexturePreview texture={selectedTexture} />
                   <div className="flex flex-col gap-1">
                     <div 
                        className="h-2 w-full border border-border bg-gradient-to-r" 
                        style={{ 
                          backgroundImage: selectedTexture.type === 'gradient' 
                            ? `linear-gradient(to right, ${selectedTexture.color}, ${selectedTexture.secondaryColor || '#000'})`
                            : 'none',
                          backgroundColor: selectedTexture.type !== 'gradient' ? selectedTexture.color : 'transparent'
                        }} 
                     />
                     <span className="text-[7px] text-text-dim uppercase font-black tracking-widest text-center">Gradient Bar</span>
                   </div>
                </div>

                <div className="flex-1 flex flex-col gap-4">
                  {/* Tabs */}
                  <div className="flex border-b border-border">
                    <button 
                      onClick={() => setActiveTab('material')}
                      className={cn(
                        "px-4 py-2 text-[10px] uppercase font-black tracking-[0.2em] transition-all",
                        activeTab === 'material' ? "text-accent border-b-2 border-accent" : "text-text-dim"
                      )}
                    >
                      <span className="flex items-center gap-2"><Wand2 size={10}/> Material</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('effects')}
                      className={cn(
                        "px-4 py-2 text-[10px] uppercase font-black tracking-[0.2em] transition-all",
                        activeTab === 'effects' ? "text-accent border-b-2 border-accent" : "text-text-dim"
                      )}
                    >
                      <span className="flex items-center gap-2"><Settings2 size={10}/> Post-FX</span>
                    </button>
                  </div>

                  {activeTab === 'material' ? (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[8px] uppercase font-black tracking-widest text-text-dim">Main Type</label>
                          <div className="relative bg-bg border border-border px-2 py-1">
                            <select 
                              className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none pr-4 appearance-none cursor-pointer w-full"
                              value={selectedTexture.type}
                              onChange={(e) => handleUpdateTexture({ type: e.target.value })}
                            >
                               <option value="solid" className="bg-black">Applied Color (Solid)</option>
                               <option value="gradient" className="bg-black">Gradient Overlay</option>
                               <option value="noise" className="bg-black">Noise Texture</option>
                               <option value="tiling" className="bg-black">Tiling Decal</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <label className="text-[8px] uppercase font-black tracking-widest text-text-dim">Texture Size</label>
                            <span className="text-[8px] font-mono text-accent">{selectedTexture.scale.toFixed(2)}</span>
                          </div>
                          <input 
                            type="range" min="0.1" max="10" step="0.1" 
                            value={selectedTexture.scale}
                            onChange={(e) => handleUpdateTexture({ scale: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-bg border border-border accent-accent appearance-none cursor-pointer" 
                          />
                        </div>

                        {(selectedTexture.type === 'gradient' || selectedTexture.type === 'noise') && (
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] uppercase font-black tracking-widest text-text-dim">Variant Selection</label>
                            <div className="relative bg-bg border border-border px-2 py-1">
                              <select 
                                className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none pr-4 appearance-none cursor-pointer w-full"
                                value={selectedTexture.variant || ''}
                                onChange={(e) => handleUpdateTexture({ variant: e.target.value })}
                              >
                                {selectedTexture.type === 'gradient' && (
                                  <>
                                    <option value="linear" className="bg-black">Linear</option>
                                    <option value="radial" className="bg-black">Radial</option>
                                  </>
                                )}
                                {selectedTexture.type === 'noise' && (
                                  <>
                                    <option value="perlin" className="bg-black">Perlin</option>
                                    <option value="simplex" className="bg-black">Simplex</option>
                                    <option value="cellular" className="bg-black">Cellular</option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                           <div className="flex-1 flex flex-col gap-1.5">
                             <label className="text-[8px] uppercase font-black tracking-widest text-text-dim">Prime Color</label>
                             <input type="color" value={selectedTexture.color} onChange={(e) => handleUpdateTexture({ color: e.target.value })} className="w-full h-8 bg-bg border border-border cursor-pointer p-0.5" />
                           </div>
                           {(selectedTexture.type !== 'solid') && (
                             <div className="flex-1 flex flex-col gap-1.5">
                               <label className="text-[8px] uppercase font-black tracking-widest text-text-dim">Second Color</label>
                               <input type="color" value={selectedTexture.secondaryColor || '#000000'} onChange={(e) => handleUpdateTexture({ secondaryColor: e.target.value })} className="w-full h-8 bg-bg border border-border cursor-pointer p-0.5" />
                             </div>
                           )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                         <div className="space-y-1">
                            <div className="flex justify-between">
                              <label className="text-[8px] uppercase font-black tracking-widest text-text-dim">Roughness</label>
                              <span className="text-[8px] font-mono text-accent">{selectedTexture.roughness.toFixed(2)}</span>
                            </div>
                            <input 
                              type="range" min="0" max="1" step="0.01" 
                              value={selectedTexture.roughness}
                              onChange={(e) => handleUpdateTexture({ roughness: parseFloat(e.target.value) })}
                              className="w-full h-1 bg-bg border border-border accent-accent appearance-none cursor-pointer" 
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <label className="text-[8px] uppercase font-black tracking-widest text-text-dim">Metalness</label>
                              <span className="text-[8px] font-mono text-accent">{selectedTexture.metalness.toFixed(2)}</span>
                            </div>
                            <input 
                              type="range" min="0" max="1" step="0.01" 
                              value={selectedTexture.metalness}
                              onChange={(e) => handleUpdateTexture({ metalness: parseFloat(e.target.value) })}
                              className="w-full h-1 bg-bg border border-border accent-accent appearance-none cursor-pointer" 
                            />
                          </div>
                      </div>
                    </div>
                  ) : (
                    /* Effects Tab */
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col gap-4">
                        <div className="space-y-2">
                           <div className="flex items-center justify-between">
                             <label className="text-[8px] uppercase font-black tracking-widest text-text-dim">Dithering Effect</label>
                             <input 
                               type="checkbox" 
                               checked={selectedTexture.dithering} 
                               onChange={(e) => handleUpdateTexture({ dithering: e.target.checked })} 
                               className="accent-accent"
                             />
                           </div>
                           <input 
                              type="range" min="0" max="1" step="0.01" 
                              disabled={!selectedTexture.dithering}
                              value={selectedTexture.intensity}
                              onChange={(e) => handleUpdateTexture({ intensity: parseFloat(e.target.value) })}
                              className="w-full h-1 bg-bg border border-border accent-accent appearance-none cursor-pointer opacity-50 disabled:opacity-20" 
                            />
                        </div>

                        <div className="flex items-center justify-between p-2 bg-bg border border-border">
                           <label className="text-[8px] uppercase font-black tracking-widest text-text-dim">Seamless Tiling</label>
                           <input 
                              type="checkbox" 
                              checked={selectedTexture.tiling} 
                              onChange={(e) => handleUpdateTexture({ tiling: e.target.checked })} 
                              className="accent-accent scale-110"
                            />
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="space-y-2">
                           <div className="flex items-center justify-between">
                             <label className="text-[8px] uppercase font-black tracking-widest text-text-dim">Quantization</label>
                             <input 
                               type="checkbox" 
                               checked={selectedTexture.quantize > 0} 
                               onChange={(e) => handleUpdateTexture({ quantize: e.target.checked ? 4 : 0 })} 
                               className="accent-accent"
                             />
                           </div>
                           <input 
                              type="range" min="2" max="16" step="1" 
                              disabled={selectedTexture.quantize === 0}
                              value={selectedTexture.quantize || 4}
                              onChange={(e) => handleUpdateTexture({ quantize: parseInt(e.target.value) })}
                              className="w-full h-1 bg-bg border border-border accent-accent appearance-none cursor-pointer opacity-50 disabled:opacity-20" 
                            />
                            <div className="flex justify-between text-[7px] text-text-dim font-mono">
                               <span>LOW BIT</span>
                               <span>HI BIT</span>
                            </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button className="flex items-center justify-center gap-2 bg-accent text-bg py-2 text-[10px] font-black uppercase tracking-widest mt-auto hover:opacity-90">
                    <Save size={12} />
                    Auto-Save Active
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border border-border bg-bg/20 p-8 text-center gap-4">
                <p className="text-text-dim text-[10px] font-bold uppercase tracking-wider">No material selected. Assign one or create a new one.</p>
                <button 
                  onClick={handleCreateNewTexture}
                  className="bg-surface border border-border px-4 py-2 text-[10px] font-black uppercase tracking-widest text-accent hover:border-accent"
                >
                  Create Material
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

