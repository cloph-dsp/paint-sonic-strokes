export interface GrainParams {
  position: number; // 0-1, position in buffer
  pitch: number; // playback rate multiplier
  density: number; // grains per second
  color: string; // effect type
}

export interface DrawPoint {
  x: number;
  y: number;
  speed: number;
  color: string;
  timestamp: number;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private isPlaying = false;
  private grainScheduler: number | null = null;
  private activeGrains: AudioBufferSourceNode[] = [];
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;

  async initialize() {
    try {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.audioContext.destination);

      // Create recording destination
      this.recordingDestination = this.audioContext.createMediaStreamDestination();
      this.masterGain.connect(this.recordingDestination);

      // Create reverb
      this.reverb = this.audioContext.createConvolver();
      this.reverb.buffer = await this.createReverbImpulse();
      
      // Create delay
      this.delay = this.audioContext.createDelay(1.0);
      this.delay.delayTime.value = 0.3;
      this.delayFeedback = this.audioContext.createGain();
      this.delayFeedback.gain.value = 0.4;
      
      // Connect delay feedback loop
      this.delay.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);
      this.delay.connect(this.masterGain);

      return true;
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      return false;
    }
  }

  private async createReverbImpulse(): Promise<AudioBuffer> {
    const length = this.audioContext!.sampleRate * 2;
    const impulse = this.audioContext!.createBuffer(2, length, this.audioContext!.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    
    return impulse;
  }

  async loadAudioFile(file: File): Promise<boolean> {
    if (!this.audioContext) return false;

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return true;
    } catch (error) {
      console.error('Failed to load audio file:', error);
      return false;
    }
  }

  createGrain(params: GrainParams, canvasWidth: number, canvasHeight: number, brushSize: number = 10) {
    if (!this.audioContext || !this.audioBuffer || !this.isPlaying) return;

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    const filterNode = this.audioContext.createBiquadFilter();
    
    source.buffer = this.audioBuffer;
    
    // Map X position to buffer position
    const startTime = params.position * this.audioBuffer.duration;
    source.start(0, startTime, 0.1); // 100ms grain duration
    
    // Map Y position to pitch (0.5 to 2.0 playback rate)
    source.playbackRate.value = 0.5 + (params.pitch * 1.5);
    
    // Apply color-based effects and brush size modulation
    this.applyColorEffect(filterNode, gainNode, params.color, brushSize);
    
    // Grain envelope - larger brushes have longer envelope
    const grainDuration = 0.05 + (brushSize / 50) * 0.1; // 50ms to 150ms
    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + grainDuration * 0.1);
    gainNode.gain.linearRampToValueAtTime(0, now + grainDuration);
    
    // Connect audio graph
    source.connect(filterNode);
    filterNode.connect(gainNode);
    
    // Route to effects based on color
    if (params.color === 'hot-pink' || params.color === 'violet-glow') {
      gainNode.connect(this.reverb!);
      this.reverb!.connect(this.masterGain!);
    } else if (params.color === 'cyber-orange') {
      gainNode.connect(this.delay!);
    } else {
      gainNode.connect(this.masterGain!);
    }
    
    // Cleanup
    this.activeGrains.push(source);
    source.onended = () => {
      const index = this.activeGrains.indexOf(source);
      if (index > -1) this.activeGrains.splice(index, 1);
    };
  }

  private applyColorEffect(filter: BiquadFilterNode, gain: GainNode, color: string, brushSize: number = 10) {
    // Brush size modulates effects: larger = more wet/spacious, smaller = tighter/dry
    const wetAmount = Math.min(brushSize / 30, 1); // 0 to 1 based on brush size
    
    switch (color) {
      case 'electric-blue':
        filter.type = 'lowpass';
        filter.frequency.value = 1000 + (wetAmount * 2000); // More open with larger brush
        filter.Q.value = 5 + (wetAmount * 5);
        break;
      case 'neon-green':
        filter.type = 'bandpass';
        filter.frequency.value = 600 + (wetAmount * 400);
        filter.Q.value = 8 + (wetAmount * 4);
        break;
      case 'hot-pink':
        filter.type = 'highpass';
        filter.frequency.value = 1000 - (wetAmount * 300);
        gain.gain.value *= (0.5 + wetAmount * 0.3); // Louder with larger brush
        break;
      case 'cyber-orange':
        filter.type = 'notch';
        filter.frequency.value = 1200 + (wetAmount * 600);
        filter.Q.value = 3 + (wetAmount * 7);
        break;
      case 'violet-glow':
        filter.type = 'peaking';
        filter.frequency.value = 300 + (wetAmount * 200);
        filter.Q.value = 2 + (wetAmount * 3);
        filter.gain.value = 4 + (wetAmount * 4);
        break;
      default:
        filter.type = 'allpass';
    }
  }

  setVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  startRecording(): boolean {
    if (!this.recordingDestination || this.isRecording) return false;

    try {
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  stopRecording(): Blob | null {
    if (!this.mediaRecorder || !this.isRecording) return null;

    this.mediaRecorder.stop();
    this.isRecording = false;

    const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
    this.recordedChunks = [];
    return blob;
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  start() {
    if (!this.audioContext) return;
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    this.isPlaying = true;
  }

  stop() {
    this.isPlaying = false;
    this.activeGrains.forEach(grain => grain.stop());
    this.activeGrains = [];
  }

  getAudioBuffer() {
    return this.audioBuffer;
  }

  isInitialized() {
    return this.audioContext !== null;
  }

  isAudioPlaying() {
    return this.isPlaying;
  }
}