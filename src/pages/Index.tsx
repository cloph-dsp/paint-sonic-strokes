import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { DrawingCanvas } from '@/components/DrawingCanvas';
import { Controls } from '@/components/Controls';
import { ColorPalette } from '@/components/ColorPalette';
import { FileDropZone } from '@/components/FileDropZone';
import { StatusDisplay } from '@/components/StatusDisplay';
import { AudioEngine } from '@/components/AudioEngine';

const Index = () => {
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAudioBuffer, setHasAudioBuffer] = useState(false);
  const [activeColor, setActiveColor] = useState('electric-blue');
  const [clearTrigger, setClearTrigger] = useState(0);
  const [showDropZone, setShowDropZone] = useState(true);
  const [volume, setVolume] = useState(0.3);
  const [brushSize, setBrushSize] = useState(15);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  useEffect(() => {
    const initializeAudio = async () => {
      const success = await audioEngineRef.current.initialize();
      if (success) {
        setIsAudioInitialized(true);
        toast.success('Audio engine ready! Load a sample to begin.');
      } else {
        toast.error('Failed to initialize audio. Please check browser compatibility.');
      }
    };

    initializeAudio();
  }, []);

  const handleFileLoad = async (file: File) => {
    const success = await audioEngineRef.current.loadAudioFile(file);
    if (success) {
      setHasAudioBuffer(true);
      setShowDropZone(false);
      toast.success(`Loaded: ${file.name}. Click play and start drawing!`);
    } else {
      toast.error('Failed to load audio file. Please try a different format.');
    }
  };

  const handlePlay = () => {
    if (!hasAudioBuffer) {
      toast.error('Please load an audio sample first.');
      return;
    }
    
    audioEngineRef.current.start();
    setIsPlaying(true);
    toast.success('Draw to create sound! Different colors = different effects.');
  };

  const handleStop = () => {
    audioEngineRef.current.stop();
    setIsPlaying(false);
    toast.info('Playback stopped.');
  };

  const handleClear = () => {
    setClearTrigger(prev => prev + 1);
    toast.info('Canvas cleared.');
  };

  const handleUndo = () => {
    // This would require more complex stroke management
    toast.info('Undo functionality coming soon!');
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    audioEngineRef.current.setVolume(newVolume);
  };

  const handleStartRecording = () => {
    const success = audioEngineRef.current.startRecording();
    if (success) {
      setIsRecording(true);
      toast.success('Recording started! Draw and your sounds will be captured.');
    } else {
      toast.error('Failed to start recording. Please try again.');
    }
  };

  const handleStopRecording = () => {
    const blob = audioEngineRef.current.stopRecording();
    if (blob) {
      setIsRecording(false);
      setRecordingBlob(blob);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draw-your-sound-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Recording saved! File downloaded.');
    } else {
      toast.error('Failed to save recording.');
    }
  };

  // Drag and drop for the entire window
  useEffect(() => {
    const handleWindowDrop = (event: DragEvent) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files || []);
      const audioFile = files.find(file => file.type.startsWith('audio/'));
      
      if (audioFile) {
        handleFileLoad(audioFile);
      }
    };

    const handleWindowDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragover', handleWindowDragOver);

    return () => {
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragover', handleWindowDragOver);
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Canvas Layer */}
      <DrawingCanvas
        audioEngine={audioEngineRef.current}
        activeColor={activeColor}
        isPlaying={isPlaying}
        onClear={clearTrigger}
        brushSize={brushSize}
      />
      
      {/* UI Overlay */}
      <div className="relative z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <Controls
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onStop={handleStop}
            onClear={handleClear}
            onUndo={handleUndo}
            onFileLoad={handleFileLoad}
            hasAudioBuffer={hasAudioBuffer}
            volume={volume}
            onVolumeChange={handleVolumeChange}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
        </div>
        
        <div className="pointer-events-auto">
          <ColorPalette
            activeColor={activeColor}
            onColorChange={setActiveColor}
          />
        </div>
      </div>

      {/* File Drop Zone */}
      <FileDropZone
        onFileLoad={handleFileLoad}
        isVisible={showDropZone && !hasAudioBuffer}
      />

      {/* Status Display */}
      <StatusDisplay
        brushSize={brushSize}
        activeColor={activeColor}
        isVisible={hasAudioBuffer && !showDropZone}
      />

      {/* Title/Branding */}
      {!isPlaying && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="text-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Draw Your Sound
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Interactive granular synthesis through drawing
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
