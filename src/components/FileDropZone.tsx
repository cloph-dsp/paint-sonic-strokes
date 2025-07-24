import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Upload, Music } from 'lucide-react';

interface FileDropZoneProps {
  onFileLoad: (file: File) => void;
  isVisible: boolean;
}

export const FileDropZone = ({ onFileLoad, isVisible }: FileDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    const audioFile = files.find(file => file.type.startsWith('audio/'));
    
    if (audioFile) {
      onFileLoad(audioFile);
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

  if (!isVisible) return null;

  return (
    <Card 
      className={`fixed inset-0 m-8 flex items-center justify-center z-50 bg-background/90 backdrop-blur-md border-2 border-dashed transition-all duration-300 ${
        isDragOver 
          ? 'border-primary bg-primary/10 shadow-[var(--glow-primary)]' 
          : 'border-border/50'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          {isDragOver ? (
            <Music className="w-16 h-16 text-primary animate-pulse" />
          ) : (
            <Upload className="w-16 h-16 text-muted-foreground" />
          )}
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-2">
            {isDragOver ? 'Drop to Load Audio' : 'Drop Audio File to Begin'}
          </h3>
          <p className="text-muted-foreground">
            Supports MP3, WAV, OGG, and other audio formats
          </p>
        </div>
      </div>
    </Card>
  );
};