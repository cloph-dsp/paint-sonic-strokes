import React, { useCallback, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Upload, Music } from 'lucide-react';

interface FileDropZoneProps {
  onFileLoad: (file: File) => void;
  isVisible: boolean;
}

export const FileDropZone = ({ onFileLoad, isVisible }: FileDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    const audioFile = files.find(file => file.type.startsWith('audio/'));
    
    if (audioFile) {
      onFileLoad(audioFile as File);
    }
  }, [onFileLoad]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      onFileLoad(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background animate-fade-in">
      <div className="relative w-full h-full">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20 animate-pulse" />
        
        {/* Main upload area */}
        <Card 
          className={`absolute inset-0 m-8 flex items-center justify-center bg-background/95 backdrop-blur-xl border-2 border-dashed transition-all duration-500 cursor-pointer ${
            isDragOver 
              ? 'border-primary bg-primary/10 shadow-[0_0_50px_var(--primary)] scale-105' 
              : 'border-border/50 hover:border-primary/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="audio/*"
          />
          <div className="text-center space-y-8 max-w-lg">
            {/* Icon */}
            <div className="flex justify-center">
              {isDragOver ? (
                <Music className="w-24 h-24 text-primary animate-bounce" />
              ) : (
                <Upload className="w-20 h-20 text-muted-foreground animate-pulse" />
              )}
            </div>
            
            {/* Title */}
            <div className="space-y-4">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Draw Your Sound
              </h1>
              <h2 className="text-2xl font-semibold text-foreground">
                {isDragOver ? 'Drop to Load Audio' : 'Welcome to Interactive Audio Art'}
              </h2>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                {isDragOver 
                  ? 'Release to load your audio file and start creating!'
                  : 'Click or drag & drop an audio file to transform your drawings into granular soundscapes'
                }
              </p>
            </div>

            {/* Features */}
            {!isDragOver && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-muted-foreground">
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                    <span className="text-primary font-bold">X</span>
                  </div>
                  <p>X-axis controls grain position</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
                    <span className="text-accent font-bold">Y</span>
                  </div>
                  <p>Y-axis controls pitch & rate</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center mx-auto">
                    <span className="text-secondary-foreground font-bold">~</span>
                  </div>
                  <p>Colors add unique effects</p>
                </div>
              </div>
            )}

            {/* Supported formats */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Supports MP3, WAV, OGG, and other audio formats
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};