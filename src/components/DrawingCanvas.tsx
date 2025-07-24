import { useRef, useEffect, useState, useCallback } from 'react';
import { AudioEngine, DrawPoint, GrainParams } from './AudioEngine';

interface DrawingCanvasProps {
  audioEngine: AudioEngine;
  activeColor: string;
  onClear: number; // Changed to number to track clear trigger
  brushSize?: number;
  undoTrigger?: number;
}

export const DrawingCanvas = ({ audioEngine, activeColor, onClear, undoTrigger, brushSize = 15 }: DrawingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number>();
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<DrawPoint[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawPoint[]>([]);
  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size to window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Configure drawing context
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.globalCompositeOperation = 'screen'; // Additive blending for glow effect
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    contextRef.current = context;

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Clear canvas effect
  useEffect(() => {
    if (onClear) {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (canvas && context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        setStrokes([]);
        setCurrentStroke([]);
      }
    }
  }, [onClear]);

  // Undo last stroke effect
  useEffect(() => {
    if (undoTrigger && contextRef.current && canvasRef.current) {
      const context = contextRef.current;
      const canvas = canvasRef.current;
      // Remove last stroke
      const newStrokes = strokes.slice(0, -1);
      setStrokes(newStrokes);
      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      // Redraw remaining strokes
      newStrokes.forEach(stroke => {
        for (let i = 1; i < stroke.length; i++) {
          drawLine(stroke[i - 1], stroke[i]);
        }
      });
    }
  }, [undoTrigger]);

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
    
    if ('touches' in event) {
      const touch = event.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }
  };

  const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    const point = getEventPoint(event);
    if (!point) return;

    setIsDrawing(true);
    const drawPoint = createDrawPoint(point.x, point.y);
    setCurrentStroke([drawPoint]);
    
    triggerGrain(drawPoint);
  }, [activeColor]);

  const draw = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (!isDrawing) return;

    const point = getEventPoint(event);
    if (!point) return;

    const drawPoint = createDrawPoint(point.x, point.y);
    
    setCurrentStroke(prev => {
      const newStroke = [...prev, drawPoint];
      
      // Draw line from last point to current point
      if (prev.length > 0) {
        drawLine(prev[prev.length - 1], drawPoint);
      }
      
      return newStroke;
    });

    triggerGrain(drawPoint);
  }, [isDrawing, activeColor]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    setStrokes(prev => [...prev, currentStroke]);
    setCurrentStroke([]);
    lastPointRef.current = null;
  }, [isDrawing, currentStroke]);

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

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full cursor-crosshair touch-none"
      style={{ 
        background: 'linear-gradient(180deg, hsl(240, 10%, 3.9%), hsl(240, 8%, 5%))',
        zIndex: 1
      }}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  );
};