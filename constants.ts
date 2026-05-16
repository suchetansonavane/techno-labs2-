
import { InstrumentType } from './types';

export const INITIAL_BPM = 128;
export const STEPS_COUNT = 16;

export interface TrackTemplate {
  type: InstrumentType;
  name: string;
  defaultVolume: number;
  defaultDecay: number;
  defaultPitch: number;
}

export const TRACKS_CONFIG: TrackTemplate[] = [
  { type: 'kick', name: 'KICK 1', defaultVolume: 0.8, defaultDecay: 0.4, defaultPitch: 45 },
  { type: 'kick2', name: 'KICK 2', defaultVolume: 0.7, defaultDecay: 0.25, defaultPitch: 55 },
  { type: 'bass', name: 'BASS', defaultVolume: 0.7, defaultDecay: 0.3, defaultPitch: 40 },
  { type: 'sitar', name: 'SITAR', defaultVolume: 0.5, defaultDecay: 1.2, defaultPitch: 146 },
  { type: 'snare', name: 'SNARE', defaultVolume: 0.6, defaultDecay: 0.15, defaultPitch: 800 },
  { type: 'clap', name: 'CLAP', defaultVolume: 0.5, defaultDecay: 0.2, defaultPitch: 1000 },
  { type: 'tom', name: 'TOM', defaultVolume: 0.6, defaultDecay: 0.3, defaultPitch: 80 },
  { type: 'perc', name: 'PERC', defaultVolume: 0.5, defaultDecay: 0.05, defaultPitch: 2500 },
  { type: 'cymbal', name: 'CYMBAL', defaultVolume: 0.3, defaultDecay: 0.8, defaultPitch: 6000 },
  { type: 'hihat', name: 'HATS', defaultVolume: 0.4, defaultDecay: 0.05, defaultPitch: 8000 },
];

export const COLORS: Record<string, string> = {
  kick: '#ff0055',
  kick2: '#ff3377',
  bass: '#0066ff',
  sitar: '#ff9900',
  snare: '#00ffcc',
  clap: '#ffaa00',
  tom: '#7000ff',
  perc: '#00ff00',
  cymbal: '#ffffff',
  hihat: '#ffff00',
  accent: '#7000ff',
  bg: '#050505',
};
