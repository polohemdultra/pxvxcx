import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { 
  Pencil, 
  Eraser, 
  PaintBucket, 
  Square as SquareIcon, 
  Triangle, 
  Circle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getLine, getRectangle, getCircle, getTriangle } from '../../utils/drawing';

export const PixelCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    stacks,
    activeStackIndex,
    activeLayerIndex, 
    setActiveLayerIndex,
    addLayer,
    addPixel, 
    addPixels,
    floodFill,
    tool, 
    setTool,
    onionSkinning,
    isCrossStackOnionEnabled,
    saveHistory,
    selectedColor,
    referenceImage,
    setReferenceImage,
    updateReferenceImage
  } = useStore();

  const activeStack = stacks[activeStackIndex];
  const { gridSize, layers, pixels } = activeStack;

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);
  const [lastPos, setLastPos] = useState<{ x: number, y: number } | null>(null);
  const [templateImg, setTemplateImg] = useState<HTMLImageElement | null>(null);

  const [isTransforming, setIsTransforming] = useState<null | 'move' | 'resize' | 'rotate'>(null);
  const [lastRawPos, setLastRawPos] = useState<{ x: number, y: number } | null>(null);

  // Load template image
  useEffect(() => {
    if (referenceImage.data) {
      const img = new Image();
      img.src = referenceImage.data;
      img.onload = () => setTemplateImg(img);
    } else {
      setTemplateImg(null);
    }
  }, [referenceImage.data]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const cellSize = size / gridSize;

    ctx.clearRect(0, 0, size, size);

    // Draw Reference Image
    if (templateImg) {
      ctx.save();
      const imgWidth = templateImg.width;
      const imgHeight = templateImg.height;
      
      const baseRatio = Math.min(size / imgWidth, size / imgHeight);
      const scaledWidth = imgWidth * baseRatio * referenceImage.scale;
      const scaledHeight = imgHeight * baseRatio * referenceImage.scale;
      
      const centerX = size / 2 + referenceImage.x;
      const centerY = size / 2 + referenceImage.y;

      ctx.translate(centerX, centerY);
      ctx.rotate((referenceImage.rotation * Math.PI) / 180);
      
      ctx.globalAlpha = activeLayerIndex === -1 ? 1.0 : 0.3;
      ctx.drawImage(templateImg, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      
      if (activeLayerIndex === -1) {
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 2;
        ctx.strokeRect(-scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        
        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 2;
        
        // Move handle (center)
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        
        // Resize handle (bottom right)
        ctx.fillRect(scaledWidth / 2 - 12, scaledHeight / 2 - 12, 24, 24); ctx.strokeRect(scaledWidth / 2 - 12, scaledHeight / 2 - 12, 24, 24);
        
        // Rotate handle (top center)
        ctx.beginPath(); ctx.moveTo(0, -scaledHeight / 2); ctx.lineTo(0, -scaledHeight / 2 - 40); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -scaledHeight / 2 - 40, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        
        // Labels for clarity
        ctx.fillStyle = '#00ffcc';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MOVE', 0, 30);
        ctx.fillText('RESIZE', scaledWidth / 2, scaledHeight / 2 + 30);
        ctx.fillText('ROTATE', 0, -scaledHeight / 2 - 60);
      }
      
      ctx.restore();
      ctx.globalAlpha = 1.0;
    }

    // Draw Grid
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(size, i * cellSize);
      ctx.stroke();
    }

    // Draw Other Stacks (CROSS ONION SKINNING)
    if (isCrossStackOnionEnabled) {
      stacks.forEach((stack, sIdx) => {
        if (sIdx === activeStackIndex) return;
        const stackCellSize = size / stack.gridSize;
        ctx.globalAlpha = 0.2; // Dim for other stacks guide
        stack.pixels.forEach(p => {
          if (!p.visible) return;
          ctx.fillStyle = p.colorId;
          ctx.fillRect(p.x * stackCellSize, p.y * stackCellSize, stackCellSize, stackCellSize);
        });
        ctx.globalAlpha = 1.0;
      });
    }

    // Draw Onion Skinning (Multiple Previous Layers)
    if (onionSkinning > 0 && activeLayerIndex > 0) {
      for (let i = 1; i <= onionSkinning; i++) {
        const targetIndex = activeLayerIndex - i;
        if (targetIndex < 0) break;
        
        const prevLayerPixels = pixels.filter(p => p.layerIndex === targetIndex);
        // Dim opacity based on how far back the layer is
        ctx.globalAlpha = 0.2 / i;
        prevLayerPixels.forEach(p => {
          ctx.fillStyle = p.colorId;
          ctx.fillRect(p.x * cellSize, p.y * cellSize, cellSize, cellSize);
        });
      }
      ctx.globalAlpha = 1.0;
    }

    // Draw Current Layer Pixels
    const currentLayerPixels = pixels.filter(p => p.layerIndex === activeLayerIndex);
    currentLayerPixels.forEach(p => {
      ctx.fillStyle = p.colorId;
      ctx.fillRect(p.x * cellSize, p.y * cellSize, cellSize, cellSize);
    });

    // Draw Tool Preview
    if (isDrawing && startPos && currentPos) {
      let previewPoints: { x: number, y: number }[] = [];
      if (tool === 'rectangle') previewPoints = getRectangle(startPos.x, startPos.y, currentPos.x, currentPos.y);
      if (tool === 'circle') previewPoints = getCircle(startPos.x, startPos.y, currentPos.x, currentPos.y);
      if (tool === 'triangle') previewPoints = getTriangle(startPos.x, startPos.y, currentPos.x, currentPos.y);
      
      ctx.fillStyle = selectedColor;
      ctx.globalAlpha = 0.5;
      previewPoints.forEach(p => {
        ctx.fillRect(p.x * cellSize, p.y * cellSize, cellSize, cellSize);
      });
      ctx.globalAlpha = 1.0;
    }
  }, [gridSize, pixels, activeLayerIndex, onionSkinning, isDrawing, startPos, currentPos, tool, selectedColor, templateImg, referenceImage]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getRawCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    
    return { x, y };
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const raw = getRawCoordinates(e);
    if (!raw) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    const x = Math.floor((raw.x / canvas.width) * gridSize);
    const y = Math.floor((raw.y / canvas.height) * gridSize);
    
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      return { x, y };
    }
    return null;
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const raw = getRawCoordinates(e);
    if (!raw) return;

    if (activeLayerIndex === -1 && templateImg) {
      const size = canvasRef.current!.width;
      const imgWidth = templateImg.width;
      const imgHeight = templateImg.height;
      const baseRatio = Math.min(size / imgWidth, size / imgHeight);
      const scaledWidth = imgWidth * baseRatio * referenceImage.scale;
      const scaledHeight = imgHeight * baseRatio * referenceImage.scale;
      
      const centerX = size / 2 + referenceImage.x;
      const centerY = size / 2 + referenceImage.y;

      // Transform raw mouse to local image space (with rotation)
      const dx = raw.x - centerX;
      const dy = raw.y - centerY;
      const rad = (-referenceImage.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

      // Check handlers
      // Rotate handle (top center)
      const rotateDist = Math.sqrt(Math.pow(localX - 0, 2) + Math.pow(localY - (-scaledHeight / 2 - 40), 2));
      if (rotateDist < 20) {
        setIsTransforming('rotate');
        setLastRawPos(raw);
        return;
      }

      // Resize handle (bottom right)
      if (Math.abs(localX - scaledWidth / 2) < 20 && Math.abs(localY - scaledHeight / 2) < 20) {
        setIsTransforming('resize');
        setLastRawPos(raw);
        return;
      }

      // Move handle (center or bounding box)
      const moveDist = Math.sqrt(Math.pow(localX, 2) + Math.pow(localY, 2));
      if (moveDist < 20 || (Math.abs(localX) < scaledWidth / 2 && Math.abs(localY) < scaledHeight / 2)) {
        setIsTransforming('move');
        setLastRawPos(raw);
        return;
      }
      return;
    }

    const coords = getCoordinates(e);
    if (coords) {
      setIsDrawing(true);
      setStartPos(coords);
      setCurrentPos(coords);
      setLastPos(coords);
      
      if (tool === 'pencil' || tool === 'eraser') {
        addPixel(coords.x, coords.y);
      } else if (tool === 'fill') {
        floodFill(coords.x, coords.y);
        setIsDrawing(false);
      }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const raw = getRawCoordinates(e);
    if (!raw || !lastRawPos) {
      if (!isDrawing) return;
    }

    if (isTransforming && raw && lastRawPos) {
      const dx = raw.x - lastRawPos.x;
      const dy = raw.y - lastRawPos.y;

      if (isTransforming === 'move') {
        updateReferenceImage({
          x: referenceImage.x + dx,
          y: referenceImage.y + dy
        });
      } else if (isTransforming === 'resize') {
        const factor = 1 + (dx + dy) / 400; // Sensible speed
        updateReferenceImage({
          scale: Math.max(0.1, referenceImage.scale * factor)
        });
      } else if (isTransforming === 'rotate') {
        const size = canvasRef.current!.width;
        const centerX = size / 2 + referenceImage.x;
        const centerY = size / 2 + referenceImage.y;
        const angleA = Math.atan2(lastRawPos.y - centerY, lastRawPos.x - centerX);
        const angleB = Math.atan2(raw.y - centerY, raw.x - centerX);
        updateReferenceImage({
          rotation: referenceImage.rotation + (angleB - angleA) * (180 / Math.PI)
        });
      }
      setLastRawPos(raw);
      return;
    }

    const coords = getCoordinates(e);
    if (coords && isDrawing) {
      setCurrentPos(coords);
      if (tool === 'pencil' || tool === 'eraser') {
        if (!lastPos || lastPos.x !== coords.x || lastPos.y !== coords.y) {
          addPixel(coords.x, coords.y);
          setLastPos(coords);
        }
      }
    }
  };

  const handleEnd = () => {
    setIsTransforming(null);
    setLastRawPos(null);

    if (activeLayerIndex === -1) {
      setIsDrawing(false);
      return;
    }
    if (isDrawing) {
      if (startPos && currentPos) {
        if (tool === 'rectangle') addPixels(getRectangle(startPos.x, startPos.y, currentPos.x, currentPos.y));
        if (tool === 'circle') addPixels(getCircle(startPos.x, startPos.y, currentPos.x, currentPos.y));
        if (tool === 'triangle') addPixels(getTriangle(startPos.x, startPos.y, currentPos.x, currentPos.y));
      }
      
      setIsDrawing(false);
      setStartPos(null);
      setCurrentPos(null);
      setLastPos(null);
      saveHistory();
    }
  };

  const currentLayer = activeLayerIndex === -1 ? { name: 'Reference' } : layers[activeLayerIndex];

  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setReferenceImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#050505] p-2 sm:p-4 gap-2 sm:gap-4 overflow-y-auto no-scrollbar">
      {/* Hidden File Input */}
      <input 
        id="ref-import"
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleImageImport}
      />
      {/* Canvas Wrapper - Strict Square */}
      <div className="w-full max-w-[min(90vw,75vh)] aspect-square bg-[#111] border border-border flex items-center justify-center relative shadow-2xl">
        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          className="w-full h-full touch-none cursor-crosshair rounded-none block"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>

      <div className="w-full max-w-[min(90vw,75vh)] flex flex-col gap-2">
        {/* Layer Navigation */}
        <div className="flex items-center justify-between bg-surface p-2 border border-border rounded-none shadow-sm">
          <button 
            onClick={() => {
              if (activeLayerIndex === 0) {
                setActiveLayerIndex(-1);
                // Trigger import if no image exists
                if (!referenceImage.data) {
                  document.getElementById('ref-import')?.click();
                }
              } else {
                setActiveLayerIndex(Math.max(-1, activeLayerIndex - 1));
              }
            }}
            disabled={activeLayerIndex === -1}
            className="p-1 text-accent disabled:opacity-10 rounded-none hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-text uppercase tracking-widest">
              {activeLayerIndex === -1 
                ? 'Layer 00 (Ref)' 
                : `Layer ${String(activeLayerIndex + 1).padStart(2, '0')}`} // {currentLayer?.name || 'Base'}
            </span>
          </div>
          <button 
            onClick={() => {
              if (activeLayerIndex === layers.length - 1) {
                addLayer();
              } else {
                setActiveLayerIndex(activeLayerIndex + 1);
              }
            }}
            className="p-1 text-accent rounded-none hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Toolbox */}
        <div className="grid grid-cols-6 gap-1.5 bg-surface p-1.5 border border-border shadow-lg rounded-none">
          {[
            { id: 'pencil', icon: Pencil },
            { id: 'fill', icon: PaintBucket },
            { id: 'rectangle', icon: SquareIcon },
            { id: 'circle', icon: Circle },
            { id: 'eraser', icon: Eraser },
            { id: 'triangle', icon: Triangle },
          ].map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTool(id as any)}
              className={cn(
                "h-10 transition-all flex items-center justify-center border rounded-none",
                tool === id 
                  ? "bg-accent border-accent text-bg" 
                  : "bg-bg border-border text-text-dim hover:text-text"
              )}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
