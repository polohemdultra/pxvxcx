import { cn } from '../../lib/utils';
import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Center } from '@react-three/drei';
import { EffectComposer, Selection, Select, Outline } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import { VoxelEngine, MeshBox } from '../../utils/voxelEngine';

const MeshGroup: React.FC<{ 
  boxes: MeshBox[], 
  color: string, 
  texture: any,
  isSelected: boolean, 
  viewMode?: string,
  onSelect: () => void 
}> = ({ boxes, color, texture, isSelected, viewMode = 'solid', onSelect }) => {
  const onBeforeCompile = (shader: any) => {
    if (texture?.quantize > 0) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float q = ${texture.quantize.toFixed(1)};
        diffuseColor.rgb = floor(diffuseColor.rgb * q + 0.5) / q;
        `
      );
    }
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
              key={`${texture?.quantize}-${texture?.id}-${viewMode}`}
              wireframe={viewMode === 'wireframe'}
            />
          </mesh>
        ))}
      </group>
    </Select>
  );
};

export const Viewport3D: React.FC = () => {
  const { stacks, objectGroups, textures, viewMode, cycleViewMode } = useStore();
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const boxes = useMemo(() => {
    return stacks.flatMap((stack, sIdx) => {
      const stackBoxes = VoxelEngine.pixelsToMeshBoxes(stack.pixels, stack.gridSize, stack.layers.length);
      
      // Scaling factor relative to a base gridSize of 16
      const scale = 16 / stack.gridSize;
      
      return stackBoxes.map(b => ({
        ...b,
        id: `stack_${sIdx}_${b.id}`,
        stackId: stack.id, // Keep track of stack
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

  return (
    <div className="w-full h-full relative bg-[#050505] flex flex-col">
      {/* 3D Viewport Area */}
      <div className="flex-1 relative">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[16, 16, 16]} />
          <OrbitControls makeDefault />
          
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={1} />

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
                    onSelect={() => setSelectedObjectId(group.id === selectedObjectId ? null : group.id)}
                  />
                );
              })}
            </Center>
          </Selection>

          <Grid 
            infiniteGrid 
            fadeDistance={50} 
            fadeStrength={5} 
            cellSize={1} 
            sectionSize={16} 
            sectionColor="#333333" 
            cellColor="#111111" 
          />
        </Canvas>
      </div>

      {/* Bottom Inventory of Objects */}
      <div className="h-48 bg-surface border-t border-border flex flex-col rounded-none z-10 overflow-hidden shrink-0">
        <div className="p-2 border-b border-border bg-bg/50 flex items-center justify-between shrink-0">
          <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim">Object Inventory</h2>
          <span className="text-[8px] font-bold text-text-dim uppercase tracking-widest">{objectGroups.length} Active Objects</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3 no-scrollbar">
          {stacks.map(stack => {
            const stackObjects = objectGroups.filter(og => og.stackId === stack.id);
            if (stackObjects.length === 0) return null;
            return (
              <div key={stack.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1 h-3 bg-accent rounded-none" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-text opacity-70 italic">{stack.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {stackObjects.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedObjectId(group.id === selectedObjectId ? null : group.id)}
                      className={cn(
                        "flex items-center gap-3 p-2 border transition-all rounded-none text-left w-full",
                        selectedObjectId === group.id 
                          ? "bg-accent border-accent text-bg" 
                          : "bg-bg border-border text-text-dim hover:border-text-dim"
                      )}
                    >
                      <div 
                        className="w-3.5 h-3.5 border border-white/20 shrink-0" 
                        style={{ backgroundColor: group.colorId }} 
                      />
                      <div className="flex-1 flex items-center justify-between min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider truncate">
                          {group.name.split('-')[1] || group.name}
                        </span>
                        <span className={cn(
                          "text-[7px] font-mono tracking-tighter opacity-50 ml-4",
                          selectedObjectId === group.id ? "text-bg" : "text-text-dim"
                        )}>
                          {group.id.slice(0, 8)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

