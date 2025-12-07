import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const audioContextRef = useRef<AudioContext>();
  const sourceRef = useRef<MediaStreamAudioSourceNode>();

  useEffect(() => {
    if (!stream || !isRecording || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize AudioContext (handle cross-browser prefixes if necessary)
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const audioCtx = audioContextRef.current;

    // Ensure AudioContext is active (browser autoplay policy might suspend it)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // Create and configure Analyser
    analyserRef.current = audioCtx.createAnalyser();
    analyserRef.current.fftSize = 64; // Lower fftSize for fewer, thicker bars
    analyserRef.current.smoothingTimeConstant = 0.85; // Smoother transitions
    
    sourceRef.current = audioCtx.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate bar width with spacing
      const totalSpacing = (bufferLength - 1) * 4; // 4px spacing
      const barWidth = (canvas.width - totalSpacing) / bufferLength;
      
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        // Scale height based on canvas height and value (0-255)
        // 0.8 factor keeps it from touching edges too much
        const barHeight = Math.max(4, (value / 255) * canvas.height * 0.9); 

        // Dynamic color: Brighter blue for louder sounds
        const opacity = 0.6 + (value / 255) * 0.4;
        ctx.fillStyle = `rgba(96, 165, 250, ${opacity})`; // Brand 400 base

        // Draw centered rounded bar
        const y = (canvas.height - barHeight) / 2;
        
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 4);
            ctx.fill();
        } else {
            ctx.fillRect(x, y, barWidth, barHeight);
        }

        x += barWidth + 4; // Width + Spacing
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      // We generally keep AudioContext alive to avoid re-initialization cost/limits,
      // but disconnect the source/analyser.
    };
  }, [stream, isRecording]);

  return (
    <canvas 
      ref={canvasRef} 
      width={500} 
      height={128} 
      className="w-full h-full object-contain"
    />
  );
};