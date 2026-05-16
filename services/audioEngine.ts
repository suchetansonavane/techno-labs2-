
import { TrackState, AudioSettings } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lpf: BiquadFilterNode | null = null;
  private hpf: BiquadFilterNode | null = null;
  private delay: DelayNode | null = null;
  private delayGain: GainNode | null = null;
  private analyzer: AnalyserNode | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;

  private isRunning = false;
  private nextStepTime = 0;
  private currentStep = 0;
  private timerId: number | null = null;

  private tracksA: Map<string, TrackState> = new Map();
  private tracksB: Map<string, TrackState> = new Map();
  private settingsA: AudioSettings = {
    bpm: 128,
    swing: 0,
    lpfFrequency: 20000,
    hpfFrequency: 20,
    delayFeedback: 0.3,
    reverbMix: 0.1
  };
  private settingsB: AudioSettings = {
    bpm: 128,
    swing: 0,
    lpfFrequency: 20000,
    hpfFrequency: 20,
    delayFeedback: 0.3,
    reverbMix: 0.1
  };
  private crossfader = 0.5;

  private deckAGain: GainNode | null = null;
  private deckBGain: GainNode | null = null;
  private lpfA: BiquadFilterNode | null = null;
  private lpfB: BiquadFilterNode | null = null;
  private hpfA: BiquadFilterNode | null = null;
  private hpfB: BiquadFilterNode | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;
  }

  public resume() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupNodes();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private setupNodes() {
    if (!this.ctx) return;

    this.analyzer = this.ctx.createAnalyser();
    this.analyzer.fftSize = 2048;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    // Deck A
    this.deckAGain = this.ctx.createGain();
    this.lpfA = this.ctx.createBiquadFilter();
    this.lpfA.type = 'lowpass';
    this.lpfA.frequency.value = this.settingsA.lpfFrequency;
    this.hpfA = this.ctx.createBiquadFilter();
    this.hpfA.type = 'highpass';
    this.hpfA.frequency.value = this.settingsA.hpfFrequency;

    // Deck B
    this.deckBGain = this.ctx.createGain();
    this.lpfB = this.ctx.createBiquadFilter();
    this.lpfB.type = 'lowpass';
    this.lpfB.frequency.value = this.settingsB.lpfFrequency;
    this.hpfB = this.ctx.createBiquadFilter();
    this.hpfB.type = 'highpass';
    this.hpfB.frequency.value = this.settingsB.hpfFrequency;

    this.delay = this.ctx.createDelay(2.0);
    this.delay.delayTime.value = 0.375;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = this.settingsA.delayFeedback;

    this.recordingDestination = this.ctx.createMediaStreamDestination();

    // Connect Deck A
    this.lpfA.connect(this.hpfA);
    this.hpfA.connect(this.deckAGain);
    this.deckAGain.connect(this.analyzer);

    // Connect Deck B
    this.lpfB.connect(this.hpfB);
    this.hpfB.connect(this.deckBGain);
    this.deckBGain.connect(this.analyzer);

    // Master path
    this.analyzer.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.connect(this.recordingDestination);

    // Initial crossfade
    this.updateCrossfader(0.5);

    // Delay & Reverb (connected to deck gains for POST-FADER sends)
    this.deckAGain.connect(this.delay);
    this.deckBGain.connect(this.delay);
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.delay);
    // Feed delay back to analyzer via master-ish gain or just destination
    this.delayGain.connect(this.analyzer);

    this.reverb = this.ctx.createConvolver();
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = this.settingsA.reverbMix;
    this.createReverbBuffer();
    
    this.deckAGain.connect(this.reverb);
    this.deckBGain.connect(this.reverb);
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.ctx.destination);
    this.reverbGain.connect(this.recordingDestination);
  }

  public getRecordingStream() {
    this.resume();
    return this.recordingDestination?.stream;
  }

  private createReverbBuffer() {
    if (!this.ctx || !this.reverb) return;
    const len = this.ctx.sampleRate * 2.0;
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let i = 0; i < 2; i++) {
      const channel = buf.getChannelData(i);
      for (let j = 0; j < len; j++) {
        channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 1.5);
      }
    }
    this.reverb.buffer = buf;
  }

  public updateCrossfader(value: number) {
    this.crossfader = value;
    if (this.deckAGain && this.deckBGain && this.ctx) {
      // Constant power crossfade
      const gainA = Math.cos(value * 0.5 * Math.PI);
      const gainB = Math.cos((1 - value) * 0.5 * Math.PI);
      this.deckAGain.gain.setTargetAtTime(gainA, this.ctx.currentTime, 0.01);
      this.deckBGain.gain.setTargetAtTime(gainB, this.ctx.currentTime, 0.01);
    }
  }

  public updateSettings(deckId: 'A' | 'B', newSettings: Partial<AudioSettings>) {
    const s = deckId === 'A' ? this.settingsA : this.settingsB;
    const updated = { ...s, ...newSettings };
    if (deckId === 'A') {
      this.settingsA = updated;
      if (this.lpfA) this.lpfA.frequency.setTargetAtTime(updated.lpfFrequency, this.ctx!.currentTime, 0.1);
      if (this.hpfA) this.hpfA.frequency.setTargetAtTime(updated.hpfFrequency, this.ctx!.currentTime, 0.1);
    } else {
      this.settingsB = updated;
      if (this.lpfB) this.lpfB.frequency.setTargetAtTime(updated.lpfFrequency, this.ctx!.currentTime, 0.1);
      if (this.hpfB) this.hpfB.frequency.setTargetAtTime(updated.hpfFrequency, this.ctx!.currentTime, 0.1);
    }

    if (this.delayGain) this.delayGain.gain.setTargetAtTime(updated.delayFeedback, this.ctx!.currentTime, 0.1);
    if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(updated.reverbMix, this.ctx!.currentTime, 0.1);
  }

  public updateTracks(deckId: 'A' | 'B', tracks: TrackState[]) {
    const targetMap = deckId === 'A' ? this.tracksA : this.tracksB;
    targetMap.clear();
    tracks.forEach(t => targetMap.set(t.id, t));
  }

  public triggerInstrument(deckId: 'A' | 'B', track: TrackState) {
    this.resume();
    if (!this.ctx) return;
    this.playInstrument(deckId, track, this.ctx.currentTime);
  }

  public start(onStep: (step: number) => void) {
    if (this.isRunning) return;
    this.resume();
    this.isRunning = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx!.currentTime;
    this.scheduler(onStep);
  }

  public stop() {
    this.isRunning = false;
    if (this.timerId) window.clearTimeout(this.timerId);
  }

  private scheduler(onStep: (step: number) => void) {
    while (this.nextStepTime < this.ctx!.currentTime + 0.1) {
      this.scheduleNote(this.currentStep, this.nextStepTime);
      onStep(this.currentStep);
      this.advanceStep();
    }
    this.timerId = window.setTimeout(() => this.scheduler(onStep), 25);
  }

  private advanceStep() {
    const secondsPerBeat = 60.0 / this.settingsA.bpm; // BPM is shared between decks for sync
    const stepDuration = 0.25 * secondsPerBeat;
    const isEvenStep = this.currentStep % 2 === 1;
    const swingOffset = isEvenStep ? (this.settingsA.swing / 100) * stepDuration : 0;
    this.nextStepTime += stepDuration + swingOffset;
    this.currentStep = (this.currentStep + 1) % 16;
  }

  private scheduleNote(step: number, time: number) {
    this.tracksA.forEach(track => {
      if (track.steps[step] && !track.isMuted) {
        this.playInstrument('A', track, time);
      }
    });
    this.tracksB.forEach(track => {
      if (track.steps[step] && !track.isMuted) {
        this.playInstrument('B', track, time);
      }
    });
  }

  private playInstrument(deckId: 'A' | 'B', track: TrackState, time: number) {
    switch (track.type) {
      case 'kick': this.playKick(deckId, track, time); break;
      case 'kick2': this.playKick2(deckId, track, time); break;
      case 'bass': this.playBass(deckId, track, time); break;
      case 'sitar': this.playSitar(deckId, track, time); break;
      case 'snare': this.playSnare(deckId, track, time); break;
      case 'clap': this.playClap(deckId, track, time); break;
      case 'tom': this.playTom(deckId, track, time); break;
      case 'perc': this.playPerc(deckId, track, time); break;
      case 'cymbal': this.playCymbal(deckId, track, time); break;
      case 'hihat': this.playHihat(deckId, track, time); break;
    }
  }

  private playKick(deckId: 'A' | 'B', track: TrackState, time: number) {
    if (!this.ctx) return;
    const lpf = deckId === 'A' ? this.lpfA : this.lpfB;
    if (!lpf) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(track.pitch * 3, time);
    osc.frequency.exponentialRampToValueAtTime(track.pitch, time + 0.1);
    gain.gain.setValueAtTime(track.volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + track.decay);
    osc.connect(gain);
    gain.connect(lpf);
    osc.start(time);
    osc.stop(time + track.decay);
  }

  private playKick2(deckId: 'A' | 'B', track: TrackState, time: number) {
    if (!this.ctx) return;
    const lpf = deckId === 'A' ? this.lpfA : this.lpfB;
    if (!lpf) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(track.pitch * 5, time);
    osc.frequency.exponentialRampToValueAtTime(track.pitch, time + 0.05);
    gain.gain.setValueAtTime(track.volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + track.decay);
    osc.connect(gain);
    gain.connect(lpf);
    osc.start(time);
    osc.stop(time + track.decay);
  }

  private playBass(deckId: 'A' | 'B', track: TrackState, time: number) {
    if (!this.ctx) return;
    const lpf = deckId === 'A' ? this.lpfA : this.lpfB;
    if (!lpf) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(track.pitch, time);
    osc.frequency.linearRampToValueAtTime(track.pitch * 0.9, time + track.decay);

    const bassFilter = this.ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(100, time);
    bassFilter.frequency.exponentialRampToValueAtTime(2000, time + track.decay);
    bassFilter.Q.setValueAtTime(2, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(track.volume, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + track.decay);
    
    osc.connect(bassFilter);
    bassFilter.connect(gain);
    gain.connect(lpf);
    osc.start(time);
    osc.stop(time + track.decay);
  }

  private playSitar(deckId: 'A' | 'B', track: TrackState, time: number) {
    if (!this.ctx) return;
    const lpf = deckId === 'A' ? this.lpfA : this.lpfB;
    if (!lpf) return;
    
    // Carrier oscillator: sawtooth for the buzzy string sound
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(track.pitch, time);
    // Slight vibrato or pitch bend
    osc.frequency.exponentialRampToValueAtTime(track.pitch * 1.01, time + 0.05);
    osc.frequency.exponentialRampToValueAtTime(track.pitch, time + track.decay);

    // FM Modulator: to add that characteristic harmonic "zing"
    const modulator = this.ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(track.pitch * 2.4, time);
    const modGain = this.ctx.createGain();
    modGain.gain.setValueAtTime(track.pitch * 2, time);
    modGain.gain.exponentialRampToValueAtTime(0.01, time + track.decay);
    
    modulator.connect(modGain);
    modGain.connect(osc.frequency);

    // Filter to emphasize the nasal/metallic quality
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(track.pitch * 3, time);
    filter.frequency.exponentialRampToValueAtTime(track.pitch * 1.5, time + track.decay);
    filter.Q.setValueAtTime(5, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(track.volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + track.decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(lpf);

    modulator.start(time);
    osc.start(time);
    
    modulator.stop(time + track.decay);
    osc.stop(time + track.decay);
  }

  private playSnare(deckId: 'A' | 'B', track: TrackState, time: number) {
    if (!this.ctx) return;
    const lpf = deckId === 'A' ? this.lpfA : this.lpfB;
    if (!lpf) return;
    const noise = this.createNoiseSource();
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(track.pitch, time);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(track.volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + track.decay);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(lpf);
    noise.start(time);
  }

  private playClap(deckId: 'A' | 'B', track: TrackState, time: number) {
    if (!this.ctx) return;
    const lpf = deckId === 'A' ? this.lpfA : this.lpfB;
    if (!lpf) return;
    const noise = this.createNoiseSource();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(track.pitch, time);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(track.volume, time + 0.005);
    gain.gain.linearRampToValueAtTime(track.volume * 0.5, time + 0.015);
    gain.gain.linearRampToValueAtTime(track.volume, time + 0.02);
    gain.gain.linearRampToValueAtTime(track.volume * 0.7, time + 0.03);
    gain.gain.linearRampToValueAtTime(track.volume, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.01, time + track.decay);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(lpf);
    noise.start(time);
  }

  private playTom(deckId: 'A' | 'B', track: TrackState, time: number) {
    if (!this.ctx) return;
    const lpf = deckId === 'A' ? this.lpfA : this.lpfB;
    if (!lpf) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(track.pitch * 2, time);
    osc.frequency.exponentialRampToValueAtTime(track.pitch, time + 0.15);
    gain.gain.setValueAtTime(track.volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + track.decay);
    osc.connect(gain);
    gain.connect(lpf);
    osc.start(time);
    osc.stop(time + track.decay);
  }

  private playPerc(deckId: 'A' | 'B', track: TrackState, time: number) {
    if (!this.ctx) return;
    const lpf = deckId === 'A' ? this.lpfA : this.lpfB;
    if (!lpf) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(track.pitch, time);
    filter.Q.setValueAtTime(10, time);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(track.volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + track.decay);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(lpf);
    osc.start(time);
    osc.stop(time + track.decay);
  }

  private playCymbal(deckId: 'A' | 'B', track: TrackState, time: number) {
    if (!this.ctx) return;
    const lpf = deckId === 'A' ? this.lpfA : this.lpfB;
    if (!lpf) return;
    const noise = this.createNoiseSource();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(track.pitch, time);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(track.volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + track.decay);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(lpf);
    noise.start(time);
  }

  private playHihat(deckId: 'A' | 'B', track: TrackState, time: number) {
    if (!this.ctx) return;
    const lpf = deckId === 'A' ? this.lpfA : this.lpfB;
    if (!lpf) return;
    const noise = this.createNoiseSource();
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(track.pitch, time);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(track.volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + track.decay);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(lpf);
    noise.start(time);
  }

  private createNoiseSource() {
    if (!this.ctx) throw new Error("AudioContext not initialized");
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    return noise;
  }

  public getAnalyzer() {
    return this.analyzer;
  }
}

export const audioEngine = new AudioEngine();
