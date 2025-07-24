import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Play, Square, RotateCcw, Upload, Trash2, Mic, MicOff, Download } from 'lucide-react';
import { useRef, useState } from 'react';

interface ControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
  onUndo: () => void;
  onFileLoad: (file: File) => void;
  hasAudioBuffer: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export const Controls = ({
  isPlaying,
  onPlay,
  onStop,
  onClear,
  onUndo,
  onFileLoad,
  hasAudioBuffer,
  volume,
  onVolumeChange,
  brushSize,
  onBrushSizeChange,
  isRecording,
  onStartRecording,
  onStopRecording
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
    <div className="fixed top-4 left-4 z-10 space-y-3">
      {/* Main Controls */}
      <Card className="p-4 bg-card/80 backdrop-blur-md border-border/50 shadow-2xl">
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

          {/* Recording Controls */}
          <div className="flex gap-2">
            {!isRecording ? (
              <Button
                onClick={onStartRecording}
                disabled={!hasAudioBuffer}
                variant="outline"
                className="border-border hover:bg-red-500/20 hover:text-red-400 transition-all duration-300"
              >
                <Mic className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={onStopRecording}
                className="bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all duration-300 animate-pulse"
              >
                <MicOff className="w-4 h-4" />
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

      {/* Volume and Brush Controls */}
      <Card className="p-3 bg-card/80 backdrop-blur-md border-border/50 shadow-xl">
        <div className="space-y-3">
          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium min-w-[40px]">VOL</span>
            <Slider
              value={[volume * 100]}
              onValueChange={(value) => onVolumeChange(value[0] / 100)}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground min-w-[30px]">{Math.round(volume * 100)}%</span>
          </div>

          {/* Brush Size Control */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium min-w-[40px]">SIZE</span>
            <Slider
              value={[brushSize]}
              onValueChange={(value) => onBrushSizeChange(value[0])}
              min={5}
              max={50}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground min-w-[30px]">{brushSize}px</span>
          </div>
        </div>
      </Card>
    </div>
  );
};