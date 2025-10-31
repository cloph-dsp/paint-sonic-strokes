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
  brushSize: number; // brush size at the time of drawing
}

interface ColorEffectSettings {
  reverbSend: number;
  delaySend: number;
  gainMultiplier: number;
  durationMultiplier: number;
  panSpread: number;
  dryLevel: number;
  densityScale: number;
  playbackRateOffset: number;
  playbackRateMultiplier: number;
  positionJitter: number;
  attackPortion: number;
  pitchRandomness: number;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private saturationNode: WaveShaperNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbSendBus: GainNode | null = null;
  private reverbReturnGain: GainNode | null = null;
  private delay: DelayNode | null = null;
  private delaySendBus: GainNode | null = null;
  private delayReturnGain: GainNode | null = null;
  private delayFeedback: GainNode | null = null;
  private isPlaying = false;
  private grainScheduler: number | null = null;
  private activeGrains: AudioBufferSourceNode[] = [];
  // Tempo sync settings
  private tempoSyncOn: boolean = false;
  private bpm: number = 120;
  private grainSubdivision: number = 4;  // divisor for quarter note (4 = 1/16)
  private delaySubdivision: number = 2;  // divisor for quarter note (2 = 1/8)
  // Recording state managed via AudioWorklet
  private recorderNode: AudioWorkletNode | null = null;
  private recorderModuleLoaded = false;
  private recordedBuffers: Float32Array[][] = [];
  private recordedChannelCount = 0;
  private recordingLength = 0;
  private isRecording = false;
  private initialized = false;

  async initialize() {
    if (this.initialized) {
      return true;
    }
    try {
      this.audioContext = new AudioContext();
      // Resume context to allow decoding and playback
      await this.audioContext.resume();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.5;

      this.saturationNode = this.audioContext.createWaveShaper();
  this.saturationNode.curve = new Float32Array(this.createSaturationCurve(1.2));
      this.saturationNode.oversample = '4x';

      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 22;
      this.compressor.ratio.value = 3.5;
      this.compressor.attack.value = 0.015;
      this.compressor.release.value = 0.18;

      // Setup analyser node for live visualizer
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 32; // low resolution spectrum
      // Route audio chain: master -> saturation -> compressor -> analyser -> destination
      this.masterGain.connect(this.saturationNode);
      this.saturationNode.connect(this.compressor);
      this.compressor.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);

      // Create reverb with initial decay based on BPM
      this.reverb = this.audioContext.createConvolver();
      const initialDecay = 2; // default reverb tail in seconds
      this.reverb.buffer = await this.createReverbImpulse(initialDecay);
    this.reverbSendBus = this.audioContext.createGain();
    this.reverbSendBus.gain.value = 1;
    this.reverbReturnGain = this.audioContext.createGain();
    this.reverbReturnGain.gain.value = 0.6;
    this.reverbSendBus.connect(this.reverb);
    this.reverb.connect(this.reverbReturnGain);
    this.reverbReturnGain.connect(this.masterGain!);
      
      // Create delay
    this.delay = this.audioContext.createDelay(1.5);
    this.delaySendBus = this.audioContext.createGain();
    this.delaySendBus.gain.value = 1;
    this.delayReturnGain = this.audioContext.createGain();
    this.delayReturnGain.gain.value = 0.45;
    this.delaySendBus.connect(this.delay);
    this.delay.connect(this.delayReturnGain);
    this.delayReturnGain.connect(this.masterGain!);
      // Set delay time based on tempo sync settings
      this.updateDelayTime();
      this.delayFeedback = this.audioContext.createGain();
    this.delayFeedback.gain.value = 0.35;
      
      // Connect delay feedback loop
      this.delay.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);

      await this.setupRecorderNode();

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      return false;
    }
  }

  private async setupRecorderNode() {
    if (!this.audioContext || !this.analyserNode) {
      return;
    }
    if (this.recorderNode) {
      return;
    }
    if (!this.audioContext.audioWorklet) {
      console.warn('AudioWorklet is unavailable; recording disabled.');
      return;
    }
    if (!this.recorderModuleLoaded) {
  const basePath = import.meta.env.BASE_URL ?? "/";
  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const modulePath = `${normalizedBase}recorder-worklet.js`;
      await this.audioContext.audioWorklet.addModule(modulePath);
      this.recorderModuleLoaded = true;
    }
    this.recorderNode = new AudioWorkletNode(this.audioContext, 'recorder-worklet', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    });
    this.recorderNode.port.onmessage = (event) => {
      if (!this.isRecording) return;
      const channelData = event.data as Float32Array[];
      this.handleRecorderFrame(channelData);
    };
    this.analyserNode.connect(this.recorderNode);
  }

  private handleRecorderFrame(channelData: Float32Array[]) {
    if (channelData.length === 0) {
      return;
    }
    this.ensureRecorderBuffers(channelData.length);
    channelData.forEach((buffer, index) => {
      this.recordedBuffers[index].push(buffer);
    });
    this.recordingLength += channelData[0].length;
  }

  private ensureRecorderBuffers(channelCount: number) {
    if (this.recordedChannelCount === channelCount && this.recordedBuffers.length === channelCount) {
      return;
    }
    this.recordedChannelCount = channelCount;
    this.recordedBuffers = Array.from({ length: channelCount }, () => []);
  }

  private createSaturationCurve(amount: number): number[] {
    const curve: number[] = new Array(2048);
    for (let i = 0; i < 2048; i++) {
      const x = (i * 2) / 2048 - 1;
      curve[i] = Math.tanh(amount * x * 1.5);
    }
    return curve;
  }

  private async createReverbImpulse(decaySeconds: number = 2): Promise<AudioBuffer> {
    // decaySeconds defines the reverb tail length in seconds
    const length = this.audioContext!.sampleRate * decaySeconds;
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
  const pannerNode = this.audioContext.createStereoPanner();
  const dryGainNode = this.audioContext.createGain();

  const bufferDuration = this.audioBuffer.duration;

    // Prepare scheduling parameters
    const nowTime = this.audioContext.currentTime;
    const subDur = (60 / this.bpm) / this.grainSubdivision;
    const delayOffset = this.tempoSyncOn ? Math.ceil(nowTime / subDur) * subDur - nowTime : 0;
    const playTime = nowTime + delayOffset;

    // Configure per-color settings
    const effectSettings = this.applyColorEffect(filterNode, gainNode, params.color, brushSize);

    // Map Y position to pitch (0.5 to 2.0 playback rate) with color tuning
    const basePlaybackRate = 0.5 + (params.pitch * 1.5);
    let playbackRate = (basePlaybackRate + effectSettings.playbackRateOffset);
    playbackRate = Math.max(0.05, playbackRate);
    playbackRate *= effectSettings.playbackRateMultiplier;
    playbackRate = Math.max(0.05, playbackRate);
    if (effectSettings.pitchRandomness > 0) {
      const jitter = (Math.random() * 2 - 1) * effectSettings.pitchRandomness;
      playbackRate = Math.max(0.05, playbackRate * (1 + jitter));
    }
    source.playbackRate.value = playbackRate;

    // Grain envelope: base duration 50-150ms, adjust in free mode by movement speed
    const baseDuration = 0.05 + (brushSize / 50) * 0.1;
    const speedFactorRaw = Math.min(params.density, 10);
    const speedFactor = Math.min(speedFactorRaw * effectSettings.densityScale, 10);
    const durationBase = this.tempoSyncOn
      ? baseDuration
      : baseDuration / (1 + speedFactor * 0.5);
    let grainDuration = Math.max(0.035, durationBase * effectSettings.durationMultiplier);
    if (bufferDuration <= 0.05) {
      grainDuration = Math.max(0.0015, bufferDuration * 0.85);
    } else {
      const bufferMargin = Math.max(0.002, bufferDuration * 0.0125);
      const allowedMax = Math.max(0.025, bufferDuration - bufferMargin);
      grainDuration = Math.min(grainDuration, allowedMax);
      grainDuration = Math.max(0.01, grainDuration);
    }
  const safetyCap = Math.max(0.001, bufferDuration - 0.0005);
    grainDuration = Math.min(grainDuration, safetyCap);

    // Map X position to buffer position with jitter
    const jitterScale = effectSettings.positionJitter;
    let startTime = params.position * bufferDuration;
    if (jitterScale > 0) {
      const jitter = (Math.random() * 2 - 1) * jitterScale * bufferDuration;
      startTime += jitter;
    }
    const maxStart = Math.max(0, bufferDuration - grainDuration - 0.0001);
    startTime = Math.max(0, Math.min(bufferDuration, startTime));
    if (params.color === 'reverse-grain') {
      startTime = Math.max(grainDuration + 0.0001, startTime);
      startTime = Math.min(bufferDuration - 0.0001, startTime);
    }

    let sourceOffset = startTime;
    let playbackDuration = grainDuration;
    if (params.color === 'reverse-grain') {
      const segmentEnd = Math.min(bufferDuration, startTime);
      const segmentStart = Math.max(0, segmentEnd - grainDuration);
      const segmentDuration = Math.max(0, segmentEnd - segmentStart);
      if (segmentDuration <= 0.001) {
        return;
      }
      const reverseBuffer = this.createBufferSegment(segmentStart, segmentDuration, true);
      if (!reverseBuffer) {
        return;
      }
      source.buffer = reverseBuffer;
      sourceOffset = 0;
      playbackDuration = segmentDuration;
      grainDuration = Math.min(grainDuration, segmentDuration);
    } else {
      const maxStart = Math.max(0, bufferDuration - grainDuration - 0.0001);
      sourceOffset = Math.max(0, Math.min(maxStart, startTime));
      source.buffer = this.audioBuffer;
    }

    // Envelope
  const envelopePeak = 0.1 * effectSettings.gainMultiplier;
  const attackTime = Math.min(grainDuration * Math.min(effectSettings.attackPortion, 0.9), grainDuration * 0.8);
    const fadeInTime = Math.max(0.0025, attackTime);
    const releaseStart = playTime + Math.max(fadeInTime, grainDuration * 0.6);
    gainNode.gain.setValueAtTime(0, playTime);
    gainNode.gain.linearRampToValueAtTime(envelopePeak, playTime + fadeInTime);
    gainNode.gain.linearRampToValueAtTime(0.0001, releaseStart);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, playTime + grainDuration);

    // Wire core graph
    source.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(pannerNode);
    dryGainNode.gain.value = Math.max(0, effectSettings.dryLevel);
    pannerNode.connect(dryGainNode);
    dryGainNode.connect(this.masterGain!);

    // Stereo placement
    const panSpread = Math.min(1, Math.max(0, effectSettings.panSpread));
    const panValue = panSpread > 0 ? (Math.random() * 2 - 1) * panSpread : 0;
    pannerNode.pan.setValueAtTime(panValue, playTime);

    // Reverb send
    if (this.reverbSendBus && effectSettings.reverbSend > 0) {
      const reverbSend = this.audioContext.createGain();
      const wetBase = effectSettings.reverbSend;
      const wetLevel = this.tempoSyncOn
        ? wetBase
        : wetBase / (1 + speedFactor * 0.3);
      reverbSend.gain.setValueAtTime(0, playTime);
      reverbSend.gain.linearRampToValueAtTime(wetLevel, playTime + fadeInTime);
      reverbSend.gain.linearRampToValueAtTime(0, playTime + grainDuration + 0.05);
      gainNode.connect(reverbSend);
      reverbSend.connect(this.reverbSendBus);
    }

    // Delay send
    if (this.delaySendBus && effectSettings.delaySend > 0) {
      const delaySend = this.audioContext.createGain();
      const wetBase = effectSettings.delaySend;
      const wetLevel = this.tempoSyncOn
        ? wetBase
        : wetBase / (1 + speedFactor * 0.25);
      delaySend.gain.setValueAtTime(0, playTime);
      delaySend.gain.linearRampToValueAtTime(wetLevel, playTime + fadeInTime);
      delaySend.gain.linearRampToValueAtTime(0, playTime + grainDuration + 0.1);
      gainNode.connect(delaySend);
      delaySend.connect(this.delaySendBus);
    }

    // Free mode delay modulation for rhythmic color
    if (!this.tempoSyncOn && params.color === 'cyber-orange' && this.delay) {
      const now = this.audioContext.currentTime;
      const baseDelay = (60 / this.bpm) / this.delaySubdivision;
      const newDelay = Math.max(0.08, baseDelay / (1 + speedFactor * 0.4));
      this.delay.delayTime.cancelScheduledValues(now);
      this.delay.delayTime.setValueAtTime(this.delay.delayTime.value, now);
      this.delay.delayTime.linearRampToValueAtTime(newDelay, now + 0.05);
    }

    // Start grain playback on connected graph with envelope duration
    source.start(playTime, sourceOffset, playbackDuration);

    // Cleanup
    this.activeGrains.push(source);
    source.onended = () => {
      const index = this.activeGrains.indexOf(source);
      if (index > -1) this.activeGrains.splice(index, 1);
    };
  }

  private createBufferSegment(startTime: number, duration: number, reverse = false): AudioBuffer | null {
    if (!this.audioContext || !this.audioBuffer) {
      return null;
    }
    const sampleRate = this.audioContext.sampleRate;
    const startSample = Math.max(0, Math.floor(startTime * sampleRate));
    const endSample = Math.min(this.audioBuffer.length, Math.floor((startTime + duration) * sampleRate));
    const frameCount = Math.max(1, endSample - startSample);
    const segment = this.audioContext.createBuffer(this.audioBuffer.numberOfChannels, frameCount, sampleRate);
    for (let channel = 0; channel < this.audioBuffer.numberOfChannels; channel++) {
      const sourceData = this.audioBuffer.getChannelData(channel);
      const targetData = segment.getChannelData(channel);
      if (reverse) {
        for (let i = 0; i < frameCount; i++) {
          targetData[i] = sourceData[endSample - 1 - i];
        }
      } else {
        targetData.set(sourceData.subarray(startSample, endSample));
      }
    }
    return segment;
  }

  private applyColorEffect(filter: BiquadFilterNode, gain: GainNode, color: string, brushSize: number = 10): ColorEffectSettings {
    const wetAmount = Math.min(brushSize / 30, 1);
    const settings: ColorEffectSettings = {
      reverbSend: 0.1,
      delaySend: 0,
      gainMultiplier: 1,
      durationMultiplier: 1,
      panSpread: 0,
      dryLevel: 1,
      densityScale: 1,
      playbackRateOffset: 0,
      playbackRateMultiplier: 1,
      positionJitter: 0.005,
      attackPortion: 0.12,
      pitchRandomness: 0.0,
    };

    gain.gain.value = 1;

    switch (color) {
      case 'electric-blue': {
        filter.type = 'lowpass';
        filter.frequency.value = 700 + (wetAmount * 2800);
        filter.Q.value = 0.8 + (wetAmount * 1.4);
        settings.reverbSend = 0.18 + (wetAmount * 0.12);
        settings.durationMultiplier = 1.15;
        settings.dryLevel = 0.95;
        settings.positionJitter = 0.012 + wetAmount * 0.01;
        settings.attackPortion = 0.16;
        settings.pitchRandomness = 0.01;
        break;
      }
      case 'neon-green': {
        filter.type = 'bandpass';
        filter.frequency.value = 450 + (wetAmount * 700);
        filter.Q.value = 4 + (wetAmount * 6);
        settings.reverbSend = 0.12 + (wetAmount * 0.08);
        settings.delaySend = 0.18 + (wetAmount * 0.12);
        settings.panSpread = Math.min(0.6, 0.35 + wetAmount * 0.2);
        settings.durationMultiplier = 0.92;
        settings.densityScale = 1.15;
        settings.playbackRateMultiplier = 1.03;
        settings.positionJitter = 0.02 + wetAmount * 0.015;
        settings.attackPortion = 0.12;
        settings.pitchRandomness = 0.025;
        break;
      }
      case 'hot-pink': {
        filter.type = 'highpass';
        const cutoff = Math.max(150, 700 - (wetAmount * 360));
        filter.frequency.value = cutoff;
        settings.reverbSend = 0.5 + (wetAmount * 0.22);
        settings.delaySend = 0.12 + (wetAmount * 0.08);
        settings.gainMultiplier = 1.35;
        settings.durationMultiplier = 1.08;
        settings.dryLevel = 0.7;
        settings.panSpread = 0.25;
        gain.gain.value = 1.1;
        settings.positionJitter = 0.018 + wetAmount * 0.02;
        settings.attackPortion = 0.2;
        settings.pitchRandomness = 0.018;
        break;
      }
      case 'cyber-orange': {
        filter.type = 'notch';
        filter.frequency.value = 950 + (wetAmount * 850);
        filter.Q.value = 2 + (wetAmount * 5);
        settings.reverbSend = 0.14 + (wetAmount * 0.08);
        settings.delaySend = 0.4 + (wetAmount * 0.25);
        settings.dryLevel = 0.9;
        settings.gainMultiplier = 1.15;
        settings.durationMultiplier = 0.95;
        settings.densityScale = 1.2;
        settings.panSpread = 0.18;
        settings.playbackRateMultiplier = 1.03;
        gain.gain.value = 0.95;
        settings.positionJitter = 0.014 + wetAmount * 0.012;
        settings.attackPortion = 0.1;
        settings.pitchRandomness = 0.012;
        break;
      }
      case 'violet-glow': {
        filter.type = 'peaking';
        filter.frequency.value = 260 + (wetAmount * 320);
        filter.Q.value = 2.2 + (wetAmount * 3);
        filter.gain.value = 3 + (wetAmount * 4);
        settings.reverbSend = 0.42 + (wetAmount * 0.18);
        settings.delaySend = 0.2 + (wetAmount * 0.1);
        settings.gainMultiplier = 1.25;
        settings.durationMultiplier = 1.12;
        settings.dryLevel = 0.85;
        settings.panSpread = 0.2;
        gain.gain.value = 1.1;
        settings.positionJitter = 0.016 + wetAmount * 0.02;
        settings.attackPortion = 0.18;
        settings.pitchRandomness = 0.02;
        break;
      }
      case 'reverse-grain': {
        filter.type = 'highpass';
        filter.frequency.value = 380 + (wetAmount * 140);
        filter.Q.value = 1.2 + (wetAmount * 0.8);
        settings.reverbSend = 0.38 + (wetAmount * 0.22);
        settings.delaySend = 0.18 + (wetAmount * 0.14);
        settings.gainMultiplier = 1.05;
        settings.durationMultiplier = 1.35;
        settings.dryLevel = 0.75;
        settings.densityScale = 0.85;
        settings.panSpread = 0.22;
        settings.playbackRateMultiplier = 0.92;
        gain.gain.value = 1.05;
        settings.positionJitter = 0.022 + wetAmount * 0.03;
        settings.attackPortion = 0.24;
        settings.pitchRandomness = 0.035;
        break;
      }
      default: {
        filter.type = 'allpass';
        settings.reverbSend = 0.1;
        break;
      }
    }

    return settings;
  }

  setVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  /** Begin WAV recording by resetting buffers */
  startRecording(): boolean {
    if (!this.audioContext || !this.recorderNode || this.isRecording) return false;
    // initialize channel buffers
    this.recordedChannelCount = 0;
    this.recordedBuffers = [];
    this.recordingLength = 0;
    this.isRecording = true;
    return true;
  }

  /** Stop WAV recording and return a Promise resolving to a WAV Blob */
  async stopRecording(): Promise<Blob | null> {
    if (!this.audioContext || !this.isRecording) return null;
    this.isRecording = false;
    if (this.recordingLength === 0 || this.recordedBuffers.length === 0) {
      return null;
    }
    try {
      const wavBlob = this.encodeWAV();
      // reset buffers
      this.recordedBuffers = [];
      this.recordingLength = 0;
      return wavBlob;
    } catch (error) {
      console.error('Failed to encode WAV:', error);
      return null;
    }
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
  /** Provides access to the analyser node used for visualizations */
  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  isInitialized() {
    return this.audioContext !== null;
  }

  isAudioPlaying() {
    return this.isPlaying;
  }

  /** Helper: flatten Float32Array buffers into one */
  private flattenChannel(buffers: Float32Array[]): Float32Array {
    const result = new Float32Array(this.recordingLength);
    let offset = 0;
    for (const buf of buffers) {
      result.set(buf, offset);
      offset += buf.length;
    }
    return result;
  }

  /** Encode recorded PCM buffers into WAV Blob */
  private encodeWAV(): Blob {
  const numChannels = this.recordedBuffers.length || 1;
    const sampleRate = this.audioContext!.sampleRate;
    // Flatten per-channel data
    const channelData = this.recordedBuffers.map(buffers => this.flattenChannel(buffers));
    // Interleave channels
    const interleaved = new Float32Array(this.recordingLength * numChannels);
    for (let i = 0; i < this.recordingLength; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        interleaved[i * numChannels + ch] = channelData[ch][i];
      }
    }
    // Create WAV file buffer
    const buffer = new ArrayBuffer(44 + interleaved.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + interleaved.length * 2, true);
    writeString(8, 'WAVE');
    // fmt subchunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    // data subchunk
    writeString(36, 'data');
    view.setUint32(40, interleaved.length * 2, true);
    // PCM samples
    let offset = 44;
    for (let i = 0; i < interleaved.length; i++) {
      let sample = interleaved[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  // Tempo sync controls
  public toggleTempoSync(on: boolean) {
    this.tempoSyncOn = on;
  }
  public setBPM(bpm: number) {
    this.bpm = bpm;
    this.updateDelayTime();
    // Update reverb decay to one beat length
    if (this.reverb && this.audioContext) {
      const decayTime = 60 / this.bpm;
      this.createReverbImpulse(decayTime).then(buffer => {
        this.reverb!.buffer = buffer;
      });
    }
  }
  public setGrainSubdivision(subdivision: number) {
    this.grainSubdivision = subdivision;
  }
  public setDelaySubdivision(subdivision: number) {
    this.delaySubdivision = subdivision;
    this.updateDelayTime();
  }
  private updateDelayTime() {
    if (this.delay && this.audioContext) {
      const now = this.audioContext.currentTime;
      const newTime = (60 / this.bpm) / this.delaySubdivision;
      // Guard against invalid or zero BPM/subdivision
      if (!isFinite(newTime) || newTime <= 0) {
        console.warn('Invalid delay time computed, skipping update:', newTime);
        return;
      }
      // Smoothly ramp delayTime to new value to avoid clicks
      this.delay.delayTime.cancelScheduledValues(now);
      // start from current value
      this.delay.delayTime.setValueAtTime(this.delay.delayTime.value, now);
      // ramp to target over 50ms
      this.delay.delayTime.linearRampToValueAtTime(newTime, now + 0.05);
    }
  }

  async dispose(): Promise<void> {
    this.stop();
    if (this.analyserNode && this.recorderNode) {
      try {
        this.analyserNode.disconnect(this.recorderNode);
      } catch (error) {
        console.warn('Failed to disconnect recorder node:', error);
      }
    }

    [
      this.reverbSendBus,
      this.reverbReturnGain,
      this.reverb,
      this.delaySendBus,
      this.delayReturnGain,
      this.delayFeedback,
      this.delay,
      this.compressor,
      this.saturationNode,
      this.masterGain,
      this.analyserNode,
      this.recorderNode,
    ].forEach(node => {
      if (node) {
        try {
          node.disconnect();
        } catch {/* ignore disconnect errors */}
      }
    });

    this.reverbSendBus = null;
    this.reverbReturnGain = null;
    this.reverb = null;
    this.delaySendBus = null;
    this.delayReturnGain = null;
    this.delayFeedback = null;
    this.delay = null;
    this.compressor = null;
    this.saturationNode = null;
    this.masterGain = null;
    this.analyserNode = null;
    this.recorderNode = null;
    this.audioBuffer = null;
    this.recordedBuffers = [];
    this.recordingLength = 0;
    this.recordedChannelCount = 0;
    this.isRecording = false;
    this.recorderModuleLoaded = false;

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (error) {
        console.warn('Failed to close audio context:', error);
      }
    }

    this.audioContext = null;
    this.initialized = false;
  }
}
