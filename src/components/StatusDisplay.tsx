import { Card } from '@/components/ui/card';

interface StatusDisplayProps {
  brushSize: number;
  activeColor: string;
  isVisible: boolean;
}

export const StatusDisplay = ({ brushSize, activeColor, isVisible }: StatusDisplayProps) => {
  if (!isVisible) return null;

  const getEffectName = (color: string): string => {
    const effectMap: Record<string, string> = {
      'electric-blue': 'Lowpass Filter',
      'neon-green': 'Bandpass Filter', 
      'hot-pink': 'Highpass + Reverb',
      'cyber-orange': 'Notch + Delay',
      'violet-glow': 'Peaking EQ + Reverb',
    };
    return effectMap[color] || 'Clean';
  };

  return (
    <Card className="fixed bottom-4 right-4 p-3 bg-card/80 backdrop-blur-md border-border/50 shadow-xl z-10">
      <div className="text-sm space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Brush:</span>
          <span className="font-medium">{brushSize}px</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Effect:</span>
          <span className="font-medium">{getEffectName(activeColor)}</span>
        </div>
      </div>
    </Card>
  );
};