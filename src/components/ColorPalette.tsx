import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ColorPaletteProps {
  activeColor: string;
  onColorChange: (color: string) => void;
}

const colors = [
  { name: 'electric-blue', label: 'Electric', effect: 'Lowpass Filter' },
  { name: 'neon-green', label: 'Organic', effect: 'Bandpass Filter' },
  { name: 'hot-pink', label: 'Ambient', effect: 'Reverb + Highpass' },
  { name: 'cyber-orange', label: 'Echo', effect: 'Delay + Notch' },
  { name: 'violet-glow', label: 'Boost', effect: 'Peaking EQ + Reverb' },
  { name: 'reverse-grain', label: 'Reverse', effect: 'Reverse Granular' },
];

export const ColorPalette = ({ activeColor, onColorChange }: ColorPaletteProps) => {
  return (
    <Card className="fixed top-4 right-4 p-4 bg-card/80 backdrop-blur-md border-border/50 shadow-2xl z-10">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground/80 mb-3">Sound Colors</h3>
        <div className="grid gap-2">
          {colors.map((color) => (
            <Button
              key={color.name}
              onClick={() => onColorChange(color.name)}
              className={cn(
                "w-full justify-start text-left h-auto p-3 transition-all duration-300",
                "border border-border/50 hover:border-border",
                activeColor === color.name 
                  ? "bg-accent text-white shadow-[var(--glow-accent)] scale-105" 
                  : "bg-secondary/50 hover:bg-secondary/80 text-secondary-foreground"
              )}
              style={{
                background: activeColor === color.name 
                  ? `linear-gradient(135deg, var(--${color.name}), var(--accent))` 
                  : undefined
              }}
            >
              <div className="flex items-center gap-3 w-full">
                <div 
                  className="w-4 h-4 rounded-full border border-white/30 shadow-lg"
                  style={{ 
                    backgroundColor: `hsl(var(--${color.name}))`,
                    boxShadow: `0 0 8px hsl(var(--${color.name}) / 0.6)`
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{color.label}</div>
                  <div className="text-xs opacity-70 truncate">{color.effect}</div>
                </div>
              </div>
            </Button>
          ))}
        </div>
        
        <div className="mt-4 p-2 bg-background/30 rounded border border-border/30">
          <p className="text-xs text-foreground/60">
            Draw to create grains: X→position, Y→pitch, speed→density
          </p>
        </div>
      </div>
    </Card>
  );
};