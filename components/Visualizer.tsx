
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { VisualSettings, VisualPalette } from '../types';

interface VisualizerProps {
  analyzer: AnalyserNode | null;
  currentStep: number;
  settings: VisualSettings;
}

const PALETTES: Record<VisualPalette, { low: THREE.Color, mid: THREE.Color, high: THREE.Color }> = {
  NEON: {
    low: new THREE.Color(0x7000ff),  // Purple
    mid: new THREE.Color(0x00ffcc),  // Cyan
    high: new THREE.Color(0xff00cc)  // Magenta
  },
  ACID: {
    low: new THREE.Color(0x00ff00),  // Green
    mid: new THREE.Color(0xffff00),  // Yellow
    high: new THREE.Color(0xccff00)  // Lime
  },
  MONO: {
    low: new THREE.Color(0x222222),  // Dark Gray
    mid: new THREE.Color(0x888888),  // Gray
    high: new THREE.Color(0xffffff)  // White
  },
  EMBER: {
    low: new THREE.Color(0xff0000),  // Red
    mid: new THREE.Color(0xffaa00),  // Orange
    high: new THREE.Color(0xffffff)  // White
  }
};

const Visualizer: React.FC<VisualizerProps> = ({ analyzer, currentStep, settings }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const PARTICLE_COUNT = 10000;
  const dataArray = useRef(new Uint8Array(0));
  const originalPositions = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.z = 6;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const r = 2 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      colors[i3] = 0.5;
      colors[i3 + 1] = 0.5;
      colors[i3 + 2] = 0.5;
      
      sizes[i] = Math.random() * 2;
    }

    originalPositions.current = new Float32Array(positions);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: settings.particleSize,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    const animate = () => {
      if (!particlesRef.current || !sceneRef.current || !rendererRef.current || !cameraRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      let lowFreq = 0.05; // Default ambient values
      let midFreq = 0.05;
      let highFreq = 0.05;
      let avgFreq = 0.05;

      if (analyzer) {
        if (dataArray.current.length !== analyzer.frequencyBinCount) {
          dataArray.current = new Uint8Array(analyzer.frequencyBinCount);
        }
        analyzer.getByteFrequencyData(dataArray.current);
        lowFreq = (dataArray.current[2] || 0) / 255; 
        midFreq = (dataArray.current[20] || 0) / 255;
        highFreq = (dataArray.current[100] || 0) / 255;
        avgFreq = dataArray.current.reduce((a, b) => a + b, 0) / dataArray.current.length / 255;
      }

      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      const colors = particlesRef.current.geometry.attributes.color.array as Float32Array;
      const time = Date.now() * 0.001;

      const palette = PALETTES[settings.palette];
      const sensitivity = settings.sensitivity;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const kickPulse = lowFreq * sensitivity;
        const jitter = (Math.random() - 0.5) * highFreq * 0.1 * sensitivity;

        if (settings.mode === 'SPHERE') {
          const ox = originalPositions.current![i3];
          const oy = originalPositions.current![i3+1];
          const oz = originalPositions.current![i3+2];
          positions[i3] += (ox * (1 + kickPulse * 0.5) - positions[i3]) * 0.1 + jitter;
          positions[i3+1] += (oy * (1 + kickPulse * 0.5) - positions[i3+1]) * 0.1 + jitter;
          positions[i3+2] += (oz * (1 + kickPulse * 0.5) - positions[i3+2]) * 0.1 + jitter;
        } else if (settings.mode === 'VORTEX') {
          const angle = time * 0.5 + i * 0.001;
          const radius = (i / PARTICLE_COUNT) * 5 + kickPulse;
          const tx = Math.cos(angle) * radius;
          const ty = Math.sin(angle) * radius;
          const tz = Math.sin(time + i * 0.1) * midFreq * 2;
          positions[i3] += (tx - positions[i3]) * 0.05 + jitter;
          positions[i3+1] += (ty - positions[i3+1]) * 0.05 + jitter;
          positions[i3+2] += (tz - positions[i3+2]) * 0.05 + jitter;
        } else if (settings.mode === 'GRID') {
            const side = Math.floor(Math.sqrt(PARTICLE_COUNT));
            const x = (i % side) - side / 2;
            const y = Math.floor(i / side) - side / 2;
            const tx = x * 0.15;
            const ty = y * 0.15;
            const tz = Math.sin(x * 0.5 + time) * Math.cos(y * 0.5 + time) * midFreq * 3 * sensitivity;
            positions[i3] += (tx - positions[i3]) * 0.05;
            positions[i3+1] += (ty - positions[i3+1]) * 0.05;
            positions[i3+2] += (tz - positions[i3+2]) * 0.05 + jitter;
        }

        const r = palette.low.r * lowFreq + palette.mid.r * midFreq + palette.high.r * highFreq;
        const g = palette.low.g * lowFreq + palette.mid.g * midFreq + palette.high.g * highFreq;
        const b = palette.low.b * lowFreq + palette.mid.b * midFreq + palette.high.b * highFreq;

        colors[i3] = THREE.MathUtils.lerp(colors[i3], Math.max(0.1, r), 0.1);
        colors[i3+1] = THREE.MathUtils.lerp(colors[i3+1], Math.max(0.1, g), 0.1);
        colors[i3+2] = THREE.MathUtils.lerp(colors[i3+2], Math.max(0.1, b), 0.1);
      }

      particlesRef.current.geometry.attributes.position.needsUpdate = true;
      particlesRef.current.geometry.attributes.color.needsUpdate = true;
      
      const rot = settings.rotationSpeed * (1 + avgFreq);
      particlesRef.current.rotation.y += rot;
      particlesRef.current.rotation.x += rot * 0.5;

      particlesRef.current.material.size = settings.particleSize * (1 + highFreq * 0.5);

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [analyzer, settings.mode, settings.palette, settings.sensitivity, settings.rotationSpeed]);

  useEffect(() => {
    if (particlesRef.current) {
        (particlesRef.current.material as THREE.PointsMaterial).size = settings.particleSize;
    }
  }, [settings.particleSize]);

  return <div ref={containerRef} className="w-full h-full bg-black overflow-hidden" />;
};

export default Visualizer;
