import { Pixel, GridSize } from '../types';

/**
 * Drawing Algorithms
 * 
 * Pure functions for calculating pixel coordinates for various shapes.
 */

export const getLine = (x0: number, y0: number, x1: number, y1: number): { x: number, y: number }[] => {
  const points: { x: number, y: number }[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
};

export const getRectangle = (x0: number, y0: number, x1: number, y1: number): { x: number, y: number }[] => {
  const points: { x: number, y: number }[] = [];
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  for (let x = minX; x <= maxX; x++) {
    points.push({ x, y: minY });
    points.push({ x, y: maxY });
  }
  for (let y = minY + 1; y < maxY; y++) {
    points.push({ x: minX, y });
    points.push({ x: maxX, y });
  }
  return points;
};

export const getCircle = (x0: number, y0: number, x1: number, y1: number): { x: number, y: number }[] => {
  const points: { x: number, y: number }[] = [];
  const radius = Math.floor(Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2)));
  
  let x = radius;
  let y = 0;
  let err = 0;

  while (x >= y) {
    points.push({ x: x0 + x, y: y0 + y });
    points.push({ x: x0 + y, y: y0 + x });
    points.push({ x: x0 - y, y: y0 + x });
    points.push({ x: x0 - x, y: y0 + y });
    points.push({ x: x0 - x, y: y0 - y });
    points.push({ x: x0 - y, y: y0 - x });
    points.push({ x: x0 + y, y: y0 - x });
    points.push({ x: x0 + x, y: y0 - y });

    if (err <= 0) {
      y += 1;
      err += 2 * y + 1;
    }
    if (err > 0) {
      x -= 1;
      err -= 2 * x + 1;
    }
  }
  return points;
};

export const getTriangle = (x0: number, y0: number, x1: number, y1: number): { x: number, y: number }[] => {
  // Simple triangle where (x0, y0) is top and bottom is defined by x1
  const points: { x: number, y: number }[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  
  // Three vertices
  const v1 = { x: x0, y: y0 };
  const v2 = { x: x0 - dx, y: y1 };
  const v3 = { x: x0 + dx, y: y1 };

  points.push(...getLine(v1.x, v1.y, v2.x, v2.y));
  points.push(...getLine(v2.x, v2.y, v3.x, v3.y));
  points.push(...getLine(v3.x, v3.y, v1.x, v1.y));

  return points;
};

export const floodFill = (
  startX: number, 
  startY: number, 
  gridSize: number, 
  pixels: Pixel[], 
  layerIndex: number
): { x: number, y: number }[] => {
  const points: { x: number, y: number }[] = [];
  const visited = new Set<string>();
  const stack: [number, number][] = [[startX, startY]];
  
  const getPixelColor = (x: number, y: number) => {
    const p = pixels.find(p => p.x === x && p.y === y && p.layerIndex === layerIndex);
    return p ? p.colorId : null;
  };

  const targetColor = getPixelColor(startX, startY);

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const key = `${x},${y}`;

    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize || visited.has(key)) continue;
    
    const currentColor = getPixelColor(x, y);
    if (currentColor === targetColor) {
      visited.add(key);
      points.push({ x, y });
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  return points;
};
