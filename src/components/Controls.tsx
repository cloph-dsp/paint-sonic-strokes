import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Upload, Trash2, Mic, MicOff } from 'lucide-react';
import { useRef, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

interface ControlsProps {
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
  tempoSyncOn: boolean;
  onTempoSyncChange: (on: boolean) => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  grainSub: number;
  onGrainSubChange: (sub: number) => void;
  delaySub: number;
  onDelaySubChange: (sub: number) => void;
}

export const Controls = ({
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
  onStopRecording,
  tempoSyncOn,
  onTempoSyncChange,
  bpm,
  onBpmChange,
  grainSub,
  onGrainSubChange,
  delaySub,
  onDelaySubChange
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
    <div className="fixed top-4 left-4 z-10 space-y-3 pointer-events-none">
      {/* Main Controls */}
      <Card className="p-4 bg-card/60 backdrop-blur-md border-border/50 shadow-2xl opacity-60 pointer-events-none">
        <div className="pointer-events-none flex items-center gap-3">
          {/* Play/Stop Controls */}
          {/* Play/Stop removed: audio plays by default */}

          {/* Recording Controls */}
            <div className="flex gap-2">
            {!isRecording ? (
              <Button
                onClick={onStartRecording}
                disabled={!hasAudioBuffer}
                variant="outline"
                className="pointer-events-auto border-border hover:bg-red-500/20 hover:text-red-400 transition-all duration-300"
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
          className="bg-secondary hover:bg-secondary/80 text-secondary-foreground shadow-lg transition-all duration-300 pointer-events-auto"
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
              className="pointer-events-auto border-border hover:bg-accent/50 transition-all duration-300"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              onClick={onClear}
              variant="outline"
              size="sm"
              className="pointer-events-auto border-border hover:bg-destructive/20 hover:text-destructive transition-all duration-300"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Volume and Brush Controls */}
      <Card className="p-3 bg-card/60 backdrop-blur-md border-border/50 shadow-xl opacity-60 pointer-events-none">
        <div className="pointer-events-none space-y-3">
          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium min-w-[40px]">VOL</span>
            <Slider
              value={[volume * 100]}
              onValueChange={(value) => onVolumeChange(value[0] / 100)}
              max={100}
              step={1}
              className="flex-1 pointer-events-auto"
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
              className="flex-1 pointer-events-auto"
            />
            <span className="text-xs text-muted-foreground min-w-[30px]">{brushSize}px</span>
          </div>
        </div>
      </Card>

      {/* Tempo Sync + Subdivision Controls */}
      <Card className="p-3 bg-card/60 backdrop-blur-md border-border/50 shadow-xl opacity-60 pointer-events-none">
        <div className="pointer-events-none flex items-center gap-4">
          <span className="text-xs text-muted-foreground font-medium">Sync</span>
          <Switch className="pointer-events-auto" checked={tempoSyncOn} onCheckedChange={onTempoSyncChange} />
          <Input
            type="number"
            value={bpm}
            onChange={e => onBpmChange(Number(e.target.value))}
            disabled={!tempoSyncOn}
            className="pointer-events-auto w-16"
          />
          <span className="text-xs text-muted-foreground">BPM</span>
          <label className="text-xs text-muted-foreground font-medium">Grain Sub</label>
          <select
            value={grainSub}
            onChange={e => onGrainSubChange(Number(e.target.value))}
            className="pointer-events-auto bg-background border border-input rounded-md p-1 text-sm"
          >
            {[1,2,4,8,16,32].map(val => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
          <label className="text-xs text-muted-foreground font-medium">Delay Sub</label>
          <select
            value={delaySub}
            onChange={e => onDelaySubChange(Number(e.target.value))}
            className="pointer-events-auto bg-background border border-input rounded-md p-1 text-sm"
          >
            {[1,2,4,8,16,32].map(val => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        </div>
      </Card>
    </div>
  );
};