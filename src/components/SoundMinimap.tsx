import { useEffect, useRef } from 'react';
import { AudioEngine } from './AudioEngine';

interface SoundMinimapProps {
  audioEngine: AudioEngine;
  width?: number;
  height?: number;
}

export const SoundMinimap = ({ audioEngine, width = 100, height = 50 }: SoundMinimapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataArrayRef = useRef<Uint8Array>();

  useEffect(() => {
    const analyser = audioEngine.getAnalyserNode();
    if (!analyser) return;
    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArrayRef.current!);
      // Fade previous
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, width, height);
      // Draw waveform
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      const sliceWidth = width / bufferLength;
      let x = 0;
      dataArrayRef.current!.forEach((v, i) => {
        const y = (v / 255) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      });
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };
    draw();
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
