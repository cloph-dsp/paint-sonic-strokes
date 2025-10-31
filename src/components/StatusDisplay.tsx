import { Card } from '@/components/ui/card';

interface StatusDisplayProps {
  brushSize: number;
  activeColor: string;
  isVisible: boolean;
  isRecording: boolean;
  volume: number;
  tempoSyncOn: boolean;
  bpm: number;
  gridOn: boolean;
}

const colorMetadata: Record<string, { label: string; effect: string }> = {
  'electric-blue': { label: 'Electric', effect: 'Lowpass Filter' },
  'neon-green': { label: 'Organic', effect: 'Bandpass Filter' },
  'hot-pink': { label: 'Ambient', effect: 'Highpass + Reverb' },
  'cyber-orange': { label: 'Echo', effect: 'Notch + Delay' },
  'violet-glow': { label: 'Boost', effect: 'Peaking EQ + Reverb' },
  'reverse-grain': { label: 'Reverse', effect: 'Reverse Granular' },
};

export const StatusDisplay = ({
  brushSize,
  activeColor,
  isVisible,
  isRecording,
  volume,
  tempoSyncOn,
  bpm,
  gridOn,
}: StatusDisplayProps) => {
  if (!isVisible) return null;

  const colorInfo = colorMetadata[activeColor] || { label: 'Custom', effect: 'Clean' };
  const volumePercent = Math.round(volume * 100);

  return (
    <Card className="fixed bottom-4 right-4 w-60 p-4 bg-card/80 backdrop-blur-md border-border/50 shadow-xl z-10 pointer-events-none">
      <div className="space-y-3 text-sm">
        {isRecording && (
          <div className="flex items-center gap-2 text-destructive text-xs font-semibold uppercase tracking-[0.2em]">
            <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Recording
          </div>
        )}

        <div className="grid gap-2 text-foreground/90">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Brush</span>
            <span className="font-medium">{brushSize}px</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Color</span>
            <span className="flex items-center gap-2 font-medium">
              <span
                className="h-3 w-3 rounded-full border border-border/60"
                style={{
                  background: `hsl(var(--${activeColor}))`,
                  boxShadow: `0 0 6px hsl(var(--${activeColor}) / 0.6)`
                }}
              />
              {colorInfo.label}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Effect</span>
            <span className="font-medium text-right max-w-[160px] leading-tight">{colorInfo.effect}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Volume</span>
            <span className="font-medium">{volumePercent}%</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tempo</span>
            <span className="font-medium">{tempoSyncOn ? `${bpm} BPM (Synced)` : 'Free Mode'}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Grid</span>
            <span className="font-medium">{gridOn ? 'On' : 'Off'}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};