
export type InstrumentType = 'kick' | 'kick2' | 'snare' | 'clap' | 'tom' | 'perc' | 'cymbal' | 'hihat' | 'bass' | 'sitar';

export interface TrackState {
  id: string; // Unique identifier (e.g., "kick-1", "bass-2")
  type: InstrumentType; // The synthesis type
  name: string;
  steps: boolean[];
  volume: number;
  pitch: number;
  decay: number;
  isMuted: boolean;
  isSoloed: boolean;
}

export interface AudioSettings {
  bpm: number;
  swing: number;
  lpfFrequency: number;
  hpfFrequency: number;
  delayFeedback: number;
  reverbMix: number;
}

export type VisualPalette = 'NEON' | 'ACID' | 'MONO' | 'EMBER';
export type VisualMode = 'SPHERE' | 'VORTEX' | 'GRID';

export interface VisualSettings {
  palette: VisualPalette;
  mode: VisualMode;
  sensitivity: number;
  particleSize: number;
  rotationSpeed: number;
  gridDisplacement: number;
  rayIntensity: number;
  blurAmount: number;
  hueShift: number;
  mirrorMode: boolean;
  trailIntensity: number;
  kaleidoscopeTiles: number;
}

export interface AnalyzerData {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  energy: number;
  kickEnergy: number;
  snareEnergy: number;
  hatEnergy: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ProjectState {
  version: string;
  tracksA: TrackState[];
  tracksB: TrackState[];
  settingsA: AudioSettings;
  settingsB: AudioSettings;
  visualSettings: VisualSettings;
  crossfader: number;
  timestamp: number;
}

export type DeckId = 'A' | 'B';
