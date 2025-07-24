import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Square, RotateCcw, Upload, Trash2 } from 'lucide-react';
import { useRef } from 'react';

interface ControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
  onUndo: () => void;
  onFileLoad: (file: File) => void;
  hasAudioBuffer: boolean;
}

export const Controls = ({
  isPlaying,
  onPlay,
  onStop,
  onClear,
  onUndo,
  onFileLoad,
  hasAudioBuffer
}: ControlsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileLoad(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="fixed top-4 left-4 p-4 bg-card/80 backdrop-blur-md border-border/50 shadow-2xl z-10">
      <div className="flex items-center gap-3">
        {/* Play/Stop Controls */}
        <div className="flex gap-2">
          {!isPlaying ? (
            <Button
              onClick={onPlay}
              disabled={!hasAudioBuffer}
              className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-lg transition-all duration-300 hover:shadow-[var(--glow-primary)]"
            >
              <Play className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={onStop}
              variant="destructive"
              className="shadow-lg transition-all duration-300"
            >
              <Square className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border" />

        {/* File Upload */}
        <Button
          onClick={handleUploadClick}
          variant="secondary"
          className="bg-secondary hover:bg-secondary/80 text-secondary-foreground shadow-lg transition-all duration-300"
        >
          <Upload className="w-4 h-4 mr-2" />
          Load Sample
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Separator */}
        <div className="w-px h-6 bg-border" />

        {/* Canvas Controls */}
        <div className="flex gap-2">
          <Button
            onClick={onUndo}
            variant="outline"
            size="sm"
            className="border-border hover:bg-accent/50 transition-all duration-300"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            onClick={onClear}
            variant="outline"
            size="sm"
            className="border-border hover:bg-destructive/20 hover:text-destructive transition-all duration-300"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};