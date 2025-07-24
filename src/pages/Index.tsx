import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { DrawingCanvas } from '@/components/DrawingCanvas';
import { Controls } from '@/components/Controls';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ColorPalette } from '@/components/ColorPalette';
import { FileDropZone } from '@/components/FileDropZone';
import { StatusDisplay } from '@/components/StatusDisplay';
import { AudioEngine } from '@/components/AudioEngine';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Info as InfoIcon, Keyboard, MousePointer, Sliders, Repeat, Mic, Upload } from 'lucide-react';

const Index = () => {
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [hasAudioBuffer, setHasAudioBuffer] = useState(false);
  const [activeColor, setActiveColor] = useState('electric-blue');
  const [clearTrigger, setClearTrigger] = useState(0);
  const [undoTrigger, setUndoTrigger] = useState(0);
  const [showDropZone, setShowDropZone] = useState(true);
  const [volume, setVolume] = useState(0.3);
  const [brushSize, setBrushSize] = useState(15);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  // Tempo sync state
  const [tempoSyncOn, setTempoSyncOn] = useState(false);
  const [bpm, setBpm] = useState(120);
  // Grain and delay subdivisions
  const [grainSub, setGrainSub] = useState(4);
  const [delaySub, setDelaySub] = useState(2);
  const defaultBrush = 15;

  // Update AudioEngine with tempo sync toggle and BPM changes
  useEffect(() => {
    audioEngineRef.current.toggleTempoSync(tempoSyncOn);
  }, [tempoSyncOn]);
  useEffect(() => {
    audioEngineRef.current.setBPM(bpm);
  }, [bpm]);
  // Update subdivisions directly (never zero)
  useEffect(() => {
    audioEngineRef.current.setGrainSubdivision(grainSub);
  }, [grainSub]);
  useEffect(() => {
    audioEngineRef.current.setDelaySubdivision(delaySub);
  }, [delaySub]);

  // Keyboard shortcuts: 1-6 colors, ArrowUp/Down brush size, R toggle recording
  useEffect(() => {
    const colorList = ['electric-blue','neon-green','hot-pink','cyber-orange','violet-glow','reverse-grain'];
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= '1' && key <= '6') {
        const idx = parseInt(key, 10) - 1;
        setActiveColor(colorList[idx]);
        e.preventDefault();
      } else if (key === 'ArrowUp') {
        setBrushSize(prev => prev + 1);
        e.preventDefault();
      } else if (key === 'ArrowDown') {
        setBrushSize(prev => Math.max(1, prev - 1));
        e.preventDefault();
      } else if (key === 'r' || key === 'R') {
        if (!isRecording) {
          handleStartRecording();
        } else {
          handleStopRecording();
        }
        e.preventDefault();
      } else if (key === 'u' || key === 'U') {
        handleUndo();
        e.preventDefault();
      } else if (key === 'c' || key === 'C') {
        handleClear();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

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
      // Auto-start audio playback
      audioEngineRef.current.start();
      toast.success(`Loaded: ${file.name}. Draw to create sound! Different colors = different effects.`);
    } else {
      toast.error('Failed to load audio file. Please try a different format.');
    }
  };


  const handleClear = () => {
    setClearTrigger(prev => prev + 1);
    toast.info('Canvas cleared.');
  };

  const handleUndo = () => {
    // Trigger undo of last stroke
    setUndoTrigger(prev => prev + 1);
    toast.info('Last stroke undone.');
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

  const handleStopRecording = async () => {
    const blob = await audioEngineRef.current.stopRecording();
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
        onClear={clearTrigger}
        undoTrigger={undoTrigger}
        brushSize={brushSize}
      />
      
      {/* UI Overlay */}
      <div className="relative z-10 pointer-events-none">
        <Controls
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
          tempoSyncOn={tempoSyncOn}
          onTempoSyncChange={setTempoSyncOn}
          bpm={bpm}
          onBpmChange={setBpm}
          grainSub={grainSub}
          onGrainSubChange={setGrainSub}
          delaySub={delaySub}
          onDelaySubChange={setDelaySub}
        />
        <ColorPalette
          activeColor={activeColor}
          onColorChange={setActiveColor}
        />
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
      {!hasAudioBuffer && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
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

      {/* Info Panel Trigger */}
      <div className="relative z-20 pointer-events-none">
        <div className="pointer-events-auto fixed bottom-4 left-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Info">
                <InfoIcon className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Usage Guide</DialogTitle>
              </DialogHeader>
              <DialogDescription>
                <div className="grid gap-4">
                  <div className="flex items-start gap-3">
                    <MousePointer className="w-6 h-6 text-primary" />
                    <div>
                      <h4 className="font-semibold">Draw to Create Grains</h4>
                      <p className="text-sm text-muted-foreground">X → position, Y → pitch, Speed → density</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Keyboard className="w-6 h-6 text-primary" />
                    <div>
                      <h4 className="font-semibold">Keyboard Shortcuts</h4>
                      <p className="text-sm text-muted-foreground">1-6 select colors; ↑/↓ adjust brush size; R toggle recording; U undo; C clear canvas</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Sliders className="w-6 h-6 text-primary" />
                    <div>
                      <h4 className="font-semibold">Brush Speed Effects</h4>
                      <p className="text-sm text-muted-foreground">Speed affects grain density, and in free mode also modulates reverb, delay, and grain size subtly based on movement speed</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mic className="w-6 h-6 text-primary" />
                    <div>
                      <h4 className="font-semibold">Recording</h4>
                      <p className="text-sm text-muted-foreground">Click mic button or press R to record; exports save as WAV files</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Upload className="w-6 h-6 text-primary" />
                    <div>
                      <h4 className="font-semibold">Sample Loading</h4>
                      <p className="text-sm text-muted-foreground">Use Load Sample button or drag-and-drop anywhere</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Repeat className="w-6 h-6 text-primary" />
                    <div>
                      <h4 className="font-semibold">Undo & Clear</h4>
                      <p className="text-sm text-muted-foreground">U to undo last stroke; C to clear canvas; or use controls</p>
                    </div>
                  </div>
                </div>
              </DialogDescription>
              <DialogFooter>
                <DialogClose asChild>
                  <Button>Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Index;
