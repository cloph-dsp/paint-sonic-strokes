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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number>();
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<DrawPoint[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawPoint[]>([]);
  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null);

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
  const getSnappedY = (y: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return y;
    const height = canvas.height;
    const centerY = height / 2;
    const stepHeight = height / (2 * semitoneSteps);
    const semitoneIndex = Math.round((centerY - y) / stepHeight);
    return centerY - semitoneIndex * stepHeight;
  };

  const calculateSpeed = (currentPoint: { x: number; y: number }, timestamp: number): number => {
    if (!lastPointRef.current) return 0;
    
    const dx = currentPoint.x - lastPointRef.current.x;
    const dy = currentPoint.y - lastPointRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const timeDelta = timestamp - lastPointRef.current.time;
    
    return timeDelta > 0 ? distance / timeDelta : 0;
  };

  const createDrawPoint = (x: number, y: number): DrawPoint => {
    const timestamp = Date.now();
    const speed = calculateSpeed({ x, y }, timestamp);
    
    lastPointRef.current = { x, y, time: timestamp };
    
    return { x, y, speed, color: activeColor, timestamp };
  };

  const triggerGrain = (point: DrawPoint) => {
    if (!audioEngine.isAudioPlaying() || !audioEngine.getAudioBuffer()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const params: GrainParams = {
      position: point.x / canvas.width, // X maps to buffer position
      pitch: 1 - (point.y / canvas.height), // Y maps to pitch (inverted)
      density: Math.min(point.speed * 0.1, 10), // Speed maps to density
      color: point.color,
    };

    audioEngine.createGrain(params, canvas.width, canvas.height, brushSize);
  };

  const drawLine = (fromPoint: DrawPoint, toPoint: DrawPoint) => {
    const context = contextRef.current;
    if (!context) return;

    const color = getColorHSL(fromPoint.color);
    
    // Dynamic line width based on speed and brush size
    const baseWidth = brushSize * 0.2;
    const speedWidth = Math.min(fromPoint.speed * 0.05, brushSize * 0.4);
    const lineWidth = baseWidth + speedWidth;

    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.shadowColor = color;
    context.shadowBlur = 10 + speedWidth;

    context.beginPath();
    context.moveTo(fromPoint.x, fromPoint.y);
    context.lineTo(toPoint.x, toPoint.y);
    context.stroke();
  };


  const getEventPoint = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    // Not used for native pointer events
    return null;
  };

  // Native pointer start handler with optional Y snapping
  const handlePointerDown = useCallback((e: PointerEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const x = rawX;
    const y = e.shiftKey ? getSnappedY(rawY) : rawY;
    setIsDrawing(true);
    const drawPoint = createDrawPoint(x, y);
    setCurrentStroke([drawPoint]);
    triggerGrain(drawPoint);
  }, [activeColor, getSnappedY]);

  // Native pointer move handler with optional Y snapping
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
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
  }, [isDrawing, activeColor, getSnappedY]);

  // Native pointer up handler
  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setStrokes(prev => [...prev, currentStroke]);
    setCurrentStroke([]);
    lastPointRef.current = null;
  }, [isDrawing, currentStroke]);

  // Attach global pointer events to allow drawing from UI overlays
  useEffect(() => {
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

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

  const getColorHSL = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      'electric-blue': 'hsl(193, 100%, 50%)',
      'neon-green': 'hsl(120, 100%, 50%)',
      'hot-pink': 'hsl(320, 100%, 60%)',
      'cyber-orange': 'hsl(30, 100%, 60%)',
      'violet-glow': 'hsl(280, 100%, 70%)',
      'reverse-grain': 'hsl(60, 100%, 70%)', // Neon yellow for reverse-grain
    };
    return colorMap[colorName] || colorMap['electric-blue'];
  };

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (showGrid) drawPitchGrid();
    strokes.forEach(stroke => {
      for (let i = 1; i < stroke.length; i++) {
        drawLine(stroke[i - 1], stroke[i]);
      }
    });
  }, [drawPitchGrid, strokes]);

  // Resize canvas and redraw grid & strokes on window resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'screen';
      contextRef.current = ctx;
      redrawCanvas();
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawCanvas]);

  // Clear canvas effect with grid redraw
  useEffect(() => {
    if (onClear) {
      setStrokes([]);
      setCurrentStroke([]);
      redrawCanvas();
    }
  }, [onClear, redrawCanvas]);

  // Undo last stroke effect with grid redraw
  useEffect(() => {
    if (undoTrigger) {
      setStrokes(prev => prev.slice(0, -1));
      redrawCanvas();
    }
  }, [undoTrigger, redrawCanvas]);


  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full cursor-crosshair touch-none"
      style={{
        background: 'linear-gradient(180deg, hsl(240, 10%, 3.9%), hsl(240, 8%, 5%))',
        zIndex: 1
      }}
    />
  );
};