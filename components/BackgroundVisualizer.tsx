
import React, { useRef, useEffect } from 'react';

import { VisualSettings } from '../types';

interface BackgroundVisualizerProps {
  analyzer: AnalyserNode | null;
  settings: VisualSettings;
  className?: string;
}

const BackgroundVisualizer: React.FC<BackgroundVisualizerProps> = ({ analyzer, settings, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArray = useRef<Uint8Array>(new Uint8Array(0));
  
  // State for kick detection
  const lastBassValue = useRef(0);
  const kickScale = useRef(1);
  const kickActive = useRef(false);
  const rotationAccumulator = useRef(0);

  // Interaction state
  const interaction = useRef({ isDragging: false, x: 0, y: 0, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      interaction.current.isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      interaction.current.x = clientX;
      interaction.current.y = clientY;
    };

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!interaction.current.isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const dx = clientX - interaction.current.x;
      const dy = clientY - interaction.current.y;
      
      // Map drag to subtle offsets
      interaction.current.offsetX = dx / 100;
      interaction.current.offsetY = dy / 100;
    };

    const handleMouseUp = () => {
      interaction.current.isDragging = false;
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('touchstart', handleMouseDown);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    let lastTime = performance.now();

    const render = (now: number = performance.now()) => {
      if (!ctx || !canvas) return;

      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      // Ease interaction offsets back to 0 when not dragging
      if (!interaction.current.isDragging) {
        interaction.current.offsetX *= 0.95;
        interaction.current.offsetY *= 0.95;
      }

      let bass = 0;
      let mids = 0;
      let highs = 0;
      const highFreqBins: number[] = [];

      if (analyzer) {
        if (dataArray.current.length !== analyzer.frequencyBinCount) {
          dataArray.current = new Uint8Array(analyzer.frequencyBinCount);
        }
        analyzer.getByteFrequencyData(dataArray.current);

        // Bins: bass (0-10), mids (10-100), highs (100-512)
        let bassSum = 0;
        for (let i = 0; i < 10; i++) bassSum += dataArray.current[i];
        bass = (bassSum / 10 / 255) * settings.sensitivity;

        let midsSum = 0;
        for (let i = 10; i < 100; i++) midsSum += dataArray.current[i];
        mids = (midsSum / 90 / 255) * settings.sensitivity * (1 + interaction.current.offsetY);

        let highsSum = 0;
        let rayCounter = 0;
        for (let i = 100; i < 512; i++) {
          const val = dataArray.current[i];
          highsSum += val;
          // Sample 64 points across the 412 bins for the rays
          if (i >= 100 + Math.floor(rayCounter * (412 / 64)) && rayCounter < 64) {
            highFreqBins.push(val);
            rayCounter++;
          }
        }
        highs = (highsSum / 412 / 255) * settings.sensitivity;

        // Kick detection
        if (bass > 0.6 && bass > lastBassValue.current + 0.1) {
          kickActive.current = true;
          kickScale.current = 2.0;
        } else {
          kickScale.current += (1.0 - kickScale.current) * 0.15;
          if (kickScale.current < 1.1) kickActive.current = false;
        }
        lastBassValue.current = bass;
      }

      // Update rotation speed based on high frequencies
      const currentRotationSpeed = settings.rotationSpeed * 500 + (highs * 5);
      rotationAccumulator.current += (currentRotationSpeed + interaction.current.offsetX * 5) * (isNaN(deltaTime) ? 0 : deltaTime);

      // Trail effect
      ctx.fillStyle = `rgba(5, 5, 5, ${1 - settings.trailIntensity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const time = rotationAccumulator.current;

      // Apply Filter/Hue Shift
      ctx.save();
      if (settings.hueShift > 0) {
        ctx.filter = `hue-rotate(${settings.hueShift * 360}deg)`;
      }

      // Kaleidoscope / Mirror Setup
      const drawScene = () => {
        // Visual 1: Point Grid Displacement
        const gridSize = 30;
        const spacingX = canvas.width / (gridSize + 1);
        const spacingY = canvas.height / (gridSize + 1);
        
        // Particle size modulated by mids
        const dotRadius = 2 * settings.particleSize * 25 * (1 + mids * 0.5);

        ctx.save();
        for (let x = 1; x <= gridSize; x++) {
          for (let y = 1; y <= gridSize; y++) {
            const restX = x * spacingX;
            const restY = y * spacingY;

            // Displacement based on proximity to center + bass
            const dx = restX - centerX;
            const dy = restY - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
            const normalizedDist = dist / maxDist;

            // Wave math modulated by bass and time
            const wave = Math.sin(normalizedDist * 10 - time * 0.5) * 30 * bass * settings.gridDisplacement;
            const rippleX = (dx / (dist || 1)) * wave;
            const rippleY = (dy / (dist || 1)) * wave;

            const posX = restX + rippleX;
            const posY = restY + rippleY;

            // Color palette logic
            let r = 112, g = 0, b = 255; 
            if (settings.palette === 'NEON') {
               r = Math.floor(112 * (1 - mids) + 0 * mids);
               g = Math.floor(0 * (1 - mids) + 255 * mids);
               b = Math.floor(255 * (1 - mids) + 204 * mids);
            } else if (settings.palette === 'ACID') {
               r = Math.floor(0 * (1 - mids) + 128 * mids);
               g = Math.floor(255 * (1 - mids) + 255 * mids);
               b = Math.floor(0 * (1 - mids) + 128 * mids);
            } else if (settings.palette === 'MONO') {
               r = g = b = Math.floor(128 + 127 * mids);
            } else if (settings.palette === 'EMBER') {
               r = Math.floor(255 * (1 - mids) + 255 * mids);
               g = Math.floor(64 * (1 - mids) + 128 * mids);
               b = Math.floor(0 * (1 - mids) + 50 * mids);
            }

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.beginPath();
            // Pulse dot size on bass peaks
            const finalRadius = dotRadius * (1 + bass * 0.8);
            ctx.arc(posX, posY, finalRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();

        // Visual 2: Ray Burst
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.globalCompositeOperation = 'lighter';
        
        if (kickActive.current) {
          ctx.filter = `blur(${settings.blurAmount * 5}px)`;
        }

        const numRays = 64;
        const baseLength = Math.min(canvas.width, canvas.height) * 0.1;
        const maxLength = Math.min(canvas.width, canvas.height) * 0.4 * settings.rayIntensity;

        for (let i = 0; i < numRays; i++) {
          // Angle shifts based on highs
          const angle = (i / numRays) * Math.PI * 2 + time * 0.05;
          const val = highFreqBins[i] || 0;
          
          // Ray length modulated by high frequencies and kick
          const rayLen = (baseLength + (val / 255) * maxLength) * kickScale.current;

          const x2 = Math.cos(angle) * rayLen;
          const y2 = Math.sin(angle) * rayLen;

          // Safety check for finite values
          if (!isFinite(x2) || !isFinite(y2)) continue;

          const gradient = ctx.createLinearGradient(0, 0, x2, y2);
          if (kickActive.current) {
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          } else {
            let rayColor = '0, 255, 204';
            if (settings.palette === 'ACID') rayColor = '128, 255, 0';
            if (settings.palette === 'MONO') rayColor = '255, 255, 255';
            if (settings.palette === 'EMBER') rayColor = '255, 128, 0';

            gradient.addColorStop(0, `rgba(${rayColor}, ${0.3 + highs})`);
            gradient.addColorStop(1, 'rgba(112, 0, 255, 0)');
          }

          ctx.strokeStyle = gradient;
          // Thicker rays on kick
          ctx.lineWidth = (2 + highs * 2) * kickScale.current;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      };

      if (settings.kaleidoscopeTiles > 1) {
        for (let i = 0; i < settings.kaleidoscopeTiles; i++) {
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate((i * Math.PI * 2) / settings.kaleidoscopeTiles);
          ctx.translate(-centerX, -centerY);
          if (settings.mirrorMode && i % 2 === 1) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          drawScene();
          ctx.restore();
        }
      } else if (settings.mirrorMode) {
        drawScene();
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        drawScene();
        ctx.restore();
      } else {
        drawScene();
      }

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('touchstart', handleMouseDown);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      resizeObserver.disconnect();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [analyzer, settings]);

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden cursor-crosshair ${className || ''}`}>
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full"
      />
    </div>
  );
};

export default BackgroundVisualizer;
