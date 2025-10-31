import { useEffect, useRef } from 'react';
import { AudioEngine } from './AudioEngine';

interface LiveVisualizerProps {
  audioEngine: AudioEngine;
  width?: number;
  height?: number;
}

export const LiveVisualizer = ({ audioEngine, width = 100, height = 50 }: LiveVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataArrayRef = useRef<Uint8Array>();

  useEffect(() => {
    const analyser = audioEngine.getAnalyserNode();
    if (!analyser) return;
    // Coarse FFT spectrum (around 32 bins)
    analyser.fftSize = 64; // frequencyBinCount = 32
    analyser.smoothingTimeConstant = 0.3; // slight smoothing
    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const drawSpectrum = () => {
      animationId = requestAnimationFrame(drawSpectrum);
      const dataArray = dataArrayRef.current;
      if (!dataArray) {
        return;
      }
      const workingArray = new Uint8Array(dataArray.length);
      workingArray.set(dataArray);
      analyser.getByteFrequencyData(workingArray);
      ctx.clearRect(0, 0, width, height);
      const barWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = workingArray[i] / 255; // normalize
        const barHeight = v * height;
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; // subtle, blends into UI
        ctx.fillRect(x, height - barHeight, barWidth * 0.8, barHeight);
        x += barWidth;
      }
    };

    drawSpectrum();
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [audioEngine, height, width]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, background: 'transparent', opacity: 0.8, borderRadius: '4px' }}
    />
  );
};
