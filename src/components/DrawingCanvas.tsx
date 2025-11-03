import { useRef, useEffect, useState, useCallback } from 'react';
import { AudioEngine, DrawPoint, GrainParams } from './AudioEngine';

interface DrawingCanvasProps {
  audioEngine: AudioEngine;
  activeColor: string;
  onClear: number; // Changed to number to track clear trigger
  brushSize?: number;
  undoTrigger?: number;
  showGrid: boolean;
}

export const DrawingCanvas = ({ audioEngine, activeColor, onClear, undoTrigger, brushSize = 15, showGrid }: DrawingCanvasProps) => {
  const STATIONARY_BASE_INTERVAL = 110;
  const STATIONARY_VARIANCE = 65;
  const STATIONARY_MIN_SPEED = 18;
  const MIN_DENSITY = 0.35;
  const SPEED_TO_DENSITY = 0.09;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Spatial minimap for grain density overview
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const minimapCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const minimapWidth = 100;
  const minimapHeight = 50;
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number>();
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<DrawPoint[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawPoint[]>([]);
  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastDrawPointRef = useRef<DrawPoint | null>(null);
  const stationaryLoopRef = useRef<number | null>(null);
  const lastStationaryEmitRef = useRef<number>(0);
  const isDrawingRef = useRef(false);

  // Pitch grid drawing utilities
  const semitoneSteps = 12;
  const drawPitchGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    const centerY = height / 2;
    const stepHeight = height / (2 * semitoneSteps);
    ctx.save();
    for (let i = -semitoneSteps; i <= semitoneSteps; i++) {
      const y = centerY - i * stepHeight;
      ctx.beginPath();
      if (i === 0) {
        ctx.strokeStyle = 'rgba(200,200,200,0.6)';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(200,200,200,0.3)';
        ctx.lineWidth = 1;
      }
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,200,200,0.5)';
      ctx.font = '12px sans-serif';
      ctx.fillText(i === 0 ? '0' : (i > 0 ? `+${i}` : `${i}`), 10, y - 4);
    }
    ctx.restore();
  }, []);
  // Snap Y coordinate to nearest semitone line
  const getSnappedY = useCallback((y: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return y;
    const height = canvas.height;
    const centerY = height / 2;
    const stepHeight = height / (2 * semitoneSteps);
    const semitoneIndex = Math.round((centerY - y) / stepHeight);
    return centerY - semitoneIndex * stepHeight;
  }, []);

  const calculateSpeed = useCallback((currentPoint: { x: number; y: number }, timestamp: number): number => {
    if (!lastPointRef.current) return 0;
    
    const dx = currentPoint.x - lastPointRef.current.x;
    const dy = currentPoint.y - lastPointRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const timeDelta = timestamp - lastPointRef.current.time;
    
    return timeDelta > 0 ? distance / timeDelta : 0;
  }, []);

  const createDrawPoint = useCallback((x: number, y: number, options?: { color?: string; speedOverride?: number }): DrawPoint => {
    const timestamp = Date.now();
    const speed = options?.speedOverride ?? calculateSpeed({ x, y }, timestamp);
    const color = options?.color ?? activeColor;

    lastPointRef.current = { x, y, time: timestamp };

    const drawPoint: DrawPoint = { x, y, speed, color, timestamp, brushSize };
    lastDrawPointRef.current = drawPoint;
    return drawPoint;
  }, [activeColor, brushSize, calculateSpeed]);

  const triggerGrain = useCallback((point: DrawPoint) => {
    if (!audioEngine.isAudioPlaying() || !audioEngine.getAudioBuffer()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const density = Math.max(MIN_DENSITY, Math.min(point.speed * SPEED_TO_DENSITY, 10));

    const params: GrainParams = {
      position: point.x / canvas.width,
      pitch: 1 - (point.y / canvas.height),
      density,
      color: point.color,
    };

    audioEngine.createGrain(params, canvas.width, canvas.height, brushSize);
    lastStationaryEmitRef.current = performance.now();

    const mctx = minimapCtxRef.current;
    if (mctx) {
      const xNorm = (point.x / canvas.width) * minimapWidth;
      const yNorm = (point.y / canvas.height) * minimapHeight;
      mctx.fillStyle = 'rgba(255,255,255,0.6)';
      mctx.beginPath();
      mctx.arc(xNorm, yNorm, 2, 0, Math.PI * 2);
      mctx.fill();
    }
  }, [audioEngine, brushSize]);

  const getColorHSL = useCallback((colorName: string): string => {
    const colorMap: Record<string, string> = {
      'electric-blue': 'hsl(193, 100%, 50%)',
      'neon-green': 'hsl(120, 100%, 50%)',
      'hot-pink': 'hsl(320, 100%, 60%)',
      'cyber-orange': 'hsl(30, 100%, 60%)',
      'violet-glow': 'hsl(280, 100%, 70%)',
      'reverse-grain': 'hsl(60, 100%, 70%)', // Neon yellow for reverse-grain
    };
    return colorMap[colorName] || colorMap['electric-blue'];
  }, []);

  const drawLine = useCallback((fromPoint: DrawPoint, toPoint: DrawPoint) => {
    const context = contextRef.current;
    if (!context) return;

    const color = getColorHSL(fromPoint.color);
    
    // Dynamic line width based on speed and original brush size
    const baseWidth = fromPoint.brushSize * 0.2;
    const speedWidth = Math.min(fromPoint.speed * 0.05, fromPoint.brushSize * 0.4);
    const lineWidth = baseWidth + speedWidth;

    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.shadowColor = color;
    context.shadowBlur = 10 + speedWidth;

    context.beginPath();
    context.moveTo(fromPoint.x, fromPoint.y);
    context.lineTo(toPoint.x, toPoint.y);
    context.stroke();
  }, [getColorHSL]);


  const getEventPoint = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    // Not used for native pointer events
    return null;
  };

  // Native pointer start handler with optional Y snapping
  const stopStationaryLoop = useCallback(() => {
    if (stationaryLoopRef.current !== null) {
      cancelAnimationFrame(stationaryLoopRef.current);
      stationaryLoopRef.current = null;
    }
  }, []);

  const startStationaryLoop = useCallback(() => {
    if (stationaryLoopRef.current !== null) return;

    const tick = () => {
      if (!isDrawingRef.current) {
        stationaryLoopRef.current = null;
        return;
      }

      const lastPoint = lastDrawPointRef.current;
      if (lastPoint) {
        const now = performance.now();
        const interval = STATIONARY_BASE_INTERVAL + Math.random() * STATIONARY_VARIANCE;
        if (now - lastStationaryEmitRef.current >= interval) {
          const stationaryPoint = createDrawPoint(lastPoint.x, lastPoint.y, {
            color: lastPoint.color,
            speedOverride: Math.max(lastPoint.speed, STATIONARY_MIN_SPEED) * (0.95 + Math.random() * 0.1),
          });
          triggerGrain(stationaryPoint);
        }
      }

      stationaryLoopRef.current = requestAnimationFrame(tick);
    };

    lastStationaryEmitRef.current = performance.now();
    stationaryLoopRef.current = requestAnimationFrame(tick);
  }, [createDrawPoint, triggerGrain]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Ensure canvas context is properly initialized
    const ctx = contextRef.current;
    if (!ctx) {
      const newCtx = canvas.getContext('2d');
      if (newCtx) {
        newCtx.lineCap = 'round';
        newCtx.lineJoin = 'round';
        newCtx.globalCompositeOperation = 'screen';
        contextRef.current = newCtx;
      } else {
        return;
      }
    }
    
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* no-op: pointer capture unsupported */
      }
    }
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const x = rawX;
    const y = e.shiftKey ? getSnappedY(rawY) : rawY;
    setIsDrawing(true);
    isDrawingRef.current = true;
    const drawPoint = createDrawPoint(x, y);
    setCurrentStroke([drawPoint]);
    triggerGrain(drawPoint);
    startStationaryLoop();
  }, [createDrawPoint, getSnappedY, startStationaryLoop, triggerGrain]);

  // Native pointer move handler with optional Y snapping
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const x = rawX;
    const y = e.shiftKey ? getSnappedY(rawY) : rawY;
    const drawPoint = createDrawPoint(x, y);
    setCurrentStroke(prev => {
      if (prev.length > 0) {
        const fromPoint = prev[prev.length - 1];
        if (e.shiftKey) {
          // horizontal snap: override fromPoint y to snapped y
          drawLine({ ...fromPoint, y }, drawPoint);
        } else {
          drawLine(fromPoint, drawPoint);
        }
      }
      return [...prev, drawPoint];
    });
    triggerGrain(drawPoint);
  }, [isDrawing, createDrawPoint, drawLine, getSnappedY, triggerGrain]);

  // Native pointer up handler
  const handlePointerUp = useCallback((e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas?.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* no-op: already released */
      }
    }
    stopStationaryLoop();
    isDrawingRef.current = false;
    if (!isDrawing) {
      lastPointRef.current = null;
      lastDrawPointRef.current = null;
      return;
    }
    setIsDrawing(false);
    setStrokes(prev => [...prev, currentStroke]);
    setCurrentStroke([]);
    lastPointRef.current = null;
    lastDrawPointRef.current = null;
  }, [currentStroke, isDrawing, stopStationaryLoop]);

  const handlePointerCancel = useCallback((e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas?.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* no-op: already released */
      }
    }
    stopStationaryLoop();
    isDrawingRef.current = false;
    setIsDrawing(false);
    setCurrentStroke([]);
    lastPointRef.current = null;
    lastDrawPointRef.current = null;
  }, [stopStationaryLoop]);

  // Attach global pointer events to allow drawing from UI overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel]);

  // Animation loop for visual effects
  useEffect(() => {
    const animate = () => {
      // Add subtle glow animations or particle effects here
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  // Spatial minimap fade loop
  useEffect(() => {
    const canvas = minimapRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    minimapCtxRef.current = ctx;
    canvas.width = minimapWidth;
    canvas.height = minimapHeight;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.clearRect(0, 0, minimapWidth, minimapHeight);
    const fade = () => {
      if (!ctx) return;
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, minimapWidth, minimapHeight);
      requestAnimationFrame(fade);
    };
    fade();
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    
    // Clear the canvas completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset canvas context properties to default state
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    
    // Draw grid if enabled
    if (showGrid) drawPitchGrid();
    
    // Redraw all strokes
    strokes.forEach(stroke => {
      for (let i = 1; i < stroke.length; i++) {
        drawLine(stroke[i - 1], stroke[i]);
      }
    });
  }, [drawPitchGrid, drawLine, strokes, showGrid]);

  // Resize canvas and redraw grid & strokes on window resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Ensure proper canvas context initialization
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      
      contextRef.current = ctx;
      redrawCanvas();
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawCanvas]);

  // Clear canvas effect with proper state reset
  useEffect(() => {
    if (onClear) {
      // Stop any ongoing drawing operations
      stopStationaryLoop();
      isDrawingRef.current = false;
      setIsDrawing(false);
      
      // Clear drawing state
      setStrokes([]);
      setCurrentStroke([]);
      
      // Reset drawing references
      lastPointRef.current = null;
      lastDrawPointRef.current = null;
      
      // Clear and redraw canvas
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if (canvas && ctx) {
        // Complete canvas reset
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'screen';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        
        // Redraw grid if enabled
        if (showGrid) {
          drawPitchGrid();
        }
      }
      
      // Clear minimap
      const mctx = minimapCtxRef.current;
      if (mctx) {
        mctx.clearRect(0, 0, minimapWidth, minimapHeight);
      }
    }
  }, [onClear, showGrid, drawPitchGrid, stopStationaryLoop]);

  // Undo last stroke: remove last committed stroke, preserve canvas/context state
  useEffect(() => {
    if (undoTrigger) {
      // Stop any stationary emission loop so we don't emit while updating state
      stopStationaryLoop();
      // Ensure drawing flags are in a known-good state
      isDrawingRef.current = false;
      setIsDrawing(false);

      // Remove the last stroke
      setStrokes(prev => {
        if (prev.length === 0) return prev;
        const newStrokes = prev.slice(0, -1);

        // Redraw on next frame to ensure state has updated and context is ready
        requestAnimationFrame(() => {
          redrawCanvas();
        });

        return newStrokes;
      });

      // Reset any transient draw references so subsequent drawing starts clean
      lastPointRef.current = null;
      lastDrawPointRef.current = null;
      console.log('Undo triggered');
    }
  }, [undoTrigger, showGrid, drawPitchGrid, stopStationaryLoop]); // Updated dependencies to same with onClear

  useEffect(() => {
    redrawCanvas();
  }, [showGrid, redrawCanvas]);

  useEffect(() => () => {
    stopStationaryLoop();
  }, [stopStationaryLoop]);


  return (
    <>
      <canvas
        ref={canvasRef}
        onPointerDown={() => {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }}
        className="fixed inset-0 w-full h-full cursor-crosshair touch-none"
        style={{
          background: 'linear-gradient(180deg, hsl(240, 10%, 3.9%), hsl(240, 8%, 5%))',
          zIndex: 1
        }}
      />
      {/* Spatial minimap overlay */}
      <canvas
        ref={minimapRef}
        className="fixed bottom-20 right-4 z-10 pointer-events-none"
        style={{ width: minimapWidth, height: minimapHeight, opacity: 0.8, borderRadius: '4px' }}
        width={minimapWidth}
        height={minimapHeight}
      />
    </>
  );
};