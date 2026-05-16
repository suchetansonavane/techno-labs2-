
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrackState, AudioSettings, InstrumentType, VisualSettings, VisualPalette, VisualMode, ProjectState } from './types';
import { TRACKS_CONFIG, INITIAL_BPM, STEPS_COUNT } from './constants';
import { audioEngine } from './services/audioEngine';
import SequencerGrid from './components/SequencerGrid';
import TrackControls from './components/TrackControls';
import Visualizer from './components/Visualizer';
import BackgroundVisualizer from './components/BackgroundVisualizer';
import AIAssistant from './components/AIAssistant';
import Header from './components/Header';

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [analyzer, setAnalyzer] = useState<AnalyserNode | null>(null);
  
  const createInitialTracks = () => TRACKS_CONFIG.map((t, idx) => ({
    id: `${t.type}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
    type: t.type,
    name: t.name,
    steps: Array(STEPS_COUNT).fill(false),
    volume: t.defaultVolume,
    pitch: t.defaultPitch,
    decay: t.defaultDecay,
    isMuted: false,
    isSoloed: false,
  }));

  const [tracksA, setTracksA] = useState<TrackState[]>(createInitialTracks());
  const [tracksB, setTracksB] = useState<TrackState[]>(createInitialTracks());
  const [activeDeck, setActiveDeck] = useState<DeckId>('A');
  const [crossfader, setCrossfader] = useState(0.5);

  const tracks = activeDeck === 'A' ? tracksA : tracksB;
  const setTracks = activeDeck === 'A' ? setTracksA : setTracksB;

  const deckColor = activeDeck === 'A' ? '#7000ff' : '#00d4ff';
  const deckShadowA = activeDeck === 'A' ? 'shadow-[0_0_20px_rgba(112,0,255,0.2)]' : '';
  const deckShadowB = activeDeck === 'B' ? 'shadow-[0_0_20px_rgba(0,212,255,0.2)]' : '';

  const [undoStackA, setUndoStackA] = useState<TrackState[][]>([]);
  const [redoStackA, setRedoStackA] = useState<TrackState[][]>([]);
  const [undoStackB, setUndoStackB] = useState<TrackState[][]>([]);
  const [redoStackB, setRedoStackB] = useState<TrackState[][]>([]);

  const undoStack = activeDeck === 'A' ? undoStackA : undoStackB;
  const setUndoStack = activeDeck === 'A' ? setUndoStackA : setUndoStackB;
  const redoStack = activeDeck === 'A' ? redoStackA : redoStackB;
  const setRedoStack = activeDeck === 'A' ? setRedoStackA : setRedoStackB;

  const [settingsA, setSettingsA] = useState<AudioSettings>({
    bpm: INITIAL_BPM,
    swing: 0,
    lpfFrequency: 20000,
    hpfFrequency: 20,
    delayFeedback: 0.15,
    reverbMix: 0.05
  });
  const [settingsB, setSettingsB] = useState<AudioSettings>({
    bpm: INITIAL_BPM,
    swing: 0,
    lpfFrequency: 20000,
    hpfFrequency: 20,
    delayFeedback: 0.15,
    reverbMix: 0.05
  });

  const settings = activeDeck === 'A' ? settingsA : settingsB;
  const setSettings = (newSettings: AudioSettings) => {
    if (activeDeck === 'A') {
      setSettingsA(newSettings);
      setSettingsB(prev => ({ ...prev, bpm: newSettings.bpm }));
    } else {
      setSettingsB(newSettings);
      setSettingsA(prev => ({ ...prev, bpm: newSettings.bpm }));
    }
  };

  const [visualSettings, setVisualSettings] = useState<VisualSettings>({
    palette: 'NEON',
    mode: 'SPHERE',
    sensitivity: 1.0,
    particleSize: 0.04,
    rotationSpeed: 0.002,
    gridDisplacement: 1.0,
    rayIntensity: 1.0,
    blurAmount: 0.5,
    hueShift: 0,
    mirrorMode: false,
    trailIntensity: 0.8,
    kaleidoscopeTiles: 1
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'AI' | 'VISUALS'>('VISUALS');
  const [isVisualizerFullscreen, setIsVisualizerFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showVisuals, setShowVisuals] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Panel Resizing Logic
  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 200 && newWidth < 800) {
        setRightPanelWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // Synchronize state with audio engine
  useEffect(() => {
    audioEngine.updateTracks('A', tracksA);
  }, [tracksA]);

  useEffect(() => {
    audioEngine.updateTracks('B', tracksB);
  }, [tracksB]);

  useEffect(() => {
    audioEngine.updateSettings('A', settingsA);
  }, [settingsA]);

  useEffect(() => {
    audioEngine.updateSettings('B', settingsB);
  }, [settingsB]);

  useEffect(() => {
    audioEngine.updateCrossfader(crossfader);
  }, [crossfader]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      setCurrentStep(0);
    } else {
      audioEngine.start((step) => setCurrentStep(step));
      setIsPlaying(true);
      setAnalyzer(audioEngine.getAnalyzer());
    }
  }, [isPlaying]);

  const pushToUndo = useCallback((currentTracks: TrackState[]) => {
    setUndoStack(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(currentTracks))]);
    setRedoStack([]);
  }, [setUndoStack, setRedoStack]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(tracks))]);
    setTracks(previous);
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, tracks, setTracks, setUndoStack, setRedoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(tracks))]);
    setTracks(next);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, tracks, setTracks, setUndoStack, setRedoStack]);

  const toggleStep = useCallback((trackId: string, stepIndex: number) => {
    pushToUndo(tracks);
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        const newSteps = [...t.steps];
        const activated = !newSteps[stepIndex];
        newSteps[stepIndex] = activated;
        
        // Auditory feedback on activation
        if (activated) {
          audioEngine.triggerInstrument(activeDeck, t);
        }
        
        return { ...t, steps: newSteps };
      }
      return t;
    }));
  }, [tracks, pushToUndo, setTracks, activeDeck]);

  const updateTrack = useCallback((trackId: string, updates: Partial<TrackState>) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, ...updates } : t));
  }, [setTracks]);

  const removeTrack = useCallback((trackId: string) => {
    pushToUndo(tracks);
    setTracks(prev => prev.filter(t => t.id !== trackId));
  }, [tracks, pushToUndo, setTracks]);

  const addTrack = useCallback((type: InstrumentType) => {
    pushToUndo(tracks);
    const template = TRACKS_CONFIG.find(t => t.type === type);
    if (!template) return;
    
    const newTrack: TrackState = {
      id: `${type}-${Date.now()}`,
      type: type,
      name: `${template.name} ${tracks.filter(t => t.type === type).length + 1}`,
      steps: Array(STEPS_COUNT).fill(false),
      volume: template.defaultVolume,
      pitch: template.defaultPitch,
      decay: template.defaultDecay,
      isMuted: false,
      isSoloed: false,
    };
    setTracks(prev => [...prev, newTrack]);
  }, [tracks, pushToUndo, setTracks]);

  const reorderTracks = useCallback((startIndex: number, endIndex: number) => {
    pushToUndo(tracks);
    const result = Array.from(tracks);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setTracks(result);
  }, [tracks, pushToUndo, setTracks]);

  const applySuggestedPattern = useCallback((instrumentType: string, steps: boolean[]) => {
    pushToUndo(tracks);
    // Find first track of this type or create one
    const existingTrack = tracks.find(t => t.type === instrumentType);
    if (existingTrack) {
      setTracks(prev => prev.map(t => t.id === existingTrack.id ? { ...t, steps: [...steps] } : t));
    } else {
      // Add a new track if none exists
      const template = TRACKS_CONFIG.find(t => t.type === instrumentType) || TRACKS_CONFIG[0];
      const newTrack: TrackState = {
        id: `${instrumentType}-${Date.now()}`,
        type: instrumentType as InstrumentType,
        name: `${template.name} (AI)`,
        steps: [...steps],
        volume: template.defaultVolume,
        pitch: template.defaultPitch,
        decay: template.defaultDecay,
        isMuted: false,
        isSoloed: false,
      };
      setTracks(prev => [...prev, newTrack]);
    }
  }, [tracks, setTracks, pushToUndo]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      const stream = audioEngine.getRecordingStream();
      if (!stream) return;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `neon-techno-track-${Date.now()}.mp3`;
        a.click();
        URL.revokeObjectURL(url);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      
      // Auto start playback if not playing
      if (!isPlaying) {
        togglePlay();
      }
    }
  }, [isRecording, isPlaying, togglePlay]);
  
  const saveProject = useCallback(() => {
    const project: ProjectState = {
      version: '1.0',
      tracksA,
      tracksB,
      settingsA,
      settingsB,
      visualSettings,
      crossfader,
      timestamp: Date.now()
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `techno-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tracksA, tracksB, settingsA, settingsB, visualSettings, crossfader]);

  const copyDeck = useCallback(() => {
    if (activeDeck === 'A') {
      setTracksB(JSON.parse(JSON.stringify(tracksA)));
      setSettingsB(JSON.parse(JSON.stringify(settingsA)));
    } else {
      setTracksA(JSON.parse(JSON.stringify(tracksB)));
      setSettingsA(JSON.parse(JSON.stringify(settingsB)));
    }
  }, [activeDeck, tracksA, tracksB, settingsA, settingsB]);

  const loadProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const project = JSON.parse(e.target?.result as string) as ProjectState;
        if (project.tracksA) setTracksA(project.tracksA);
        if (project.tracksB) setTracksB(project.tracksB);
        if (project.settingsA) setSettingsA(project.settingsA);
        if (project.settingsB) setSettingsB(project.settingsB);
        if (project.visualSettings) setVisualSettings(project.visualSettings);
        if (typeof project.crossfader === 'number') setCrossfader(project.crossfader);
      } catch (err) {
        console.error("Failed to load project:", err);
        alert("Invalid project file");
      }
    };
    reader.readAsText(file);
  }, []);

  return (
    <div className="flex flex-col h-screen text-gray-200 overflow-hidden select-none relative bg-[#050505]">
      <div className="relative z-10 flex flex-col h-full">
        <Header 
          isPlaying={isPlaying} 
          togglePlay={togglePlay} 
          settings={settings} 
          setSettings={setSettings} 
          toggleRecording={toggleRecording}
          isRecording={isRecording}
          onSaveProject={saveProject}
          onLoadProject={loadProject}
          showVisuals={showVisuals}
          onToggleVisuals={() => setShowVisuals(!showVisuals)}
        />

        <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <div className={`flex-1 flex flex-col transition-all duration-500 overflow-y-auto ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}>
            
            <div className={`relative ${showVisuals ? 'h-64 md:h-[45vh]' : 'h-0'} border-b border-white/5 bg-black/40 overflow-hidden transition-all duration-500`}>
              {showVisuals && <Visualizer analyzer={analyzer} currentStep={currentStep} settings={visualSettings} />}
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button 
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 bg-black/50 border border-white/20 hover:border-accent rounded text-xs"
                >
                  {isFullscreen ? <i className="fas fa-compress"></i> : <i className="fas fa-expand"></i>}
                </button>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-4 items-center bg-black/60 p-3 rounded border border-white/10 backdrop-blur-sm z-10">
                  <div className="flex items-center gap-2">
                      <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Mode</label>
                      <select 
                          value={visualSettings.mode} 
                          onChange={(e) => setVisualSettings({...visualSettings, mode: e.target.value as VisualMode})}
                          className="bg-black/40 text-[10px] text-white border border-white/10 px-2 py-1 rounded outline-none focus:border-accent"
                      >
                          <option value="SPHERE">Sphere</option>
                          <option value="VORTEX">Vortex</option>
                          <option value="GRID">Grid</option>
                      </select>
                  </div>

                  <div className="flex items-center gap-2">
                      <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Palette</label>
                      <div className="flex gap-1">
                          {(['NEON', 'ACID', 'MONO', 'EMBER'] as VisualPalette[]).map(p => (
                              <button 
                                  key={p}
                                  onClick={() => setVisualSettings({...visualSettings, palette: p})}
                                  className={`w-4 h-4 rounded-full border transition-all ${visualSettings.palette === p ? 'border-white scale-125' : 'border-white/10'}`}
                                  style={{ backgroundColor: p === 'NEON' ? '#7000ff' : p === 'ACID' ? '#00ff00' : p === 'MONO' ? '#ffffff' : '#ff0000' }}
                                  title={p}
                              />
                          ))}
                      </div>
                  </div>

                  <div className="flex items-center gap-3 flex-1 min-w-[150px]">
                      <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">Sensitivity</label>
                      <input 
                          type="range" min="0" max="3" step="0.1" 
                          value={visualSettings.sensitivity}
                          onChange={(e) => setVisualSettings({...visualSettings, sensitivity: parseFloat(e.target.value)})}
                          className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                  </div>

                  <div className="flex items-center gap-3 flex-1 min-w-[150px]">
                      <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">Size</label>
                      <input 
                          type="range" min="0.01" max="0.1" step="0.005" 
                          value={visualSettings.particleSize}
                          onChange={(e) => setVisualSettings({...visualSettings, particleSize: parseFloat(e.target.value)})}
                          className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                  </div>
              </div>
            </div>

            <div className="p-4 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center bg-black/80 p-6 rounded-xl border border-white/10 gap-8 shadow-2xl backdrop-blur-xl">
                 <div className="flex flex-col gap-3">
                    <label className="text-[10px] text-gray-500 font-black tracking-[0.2em] uppercase text-center md:text-left">Engine Select</label>
                    <div className="flex gap-1 bg-black/60 p-1.5 rounded-lg border border-white/5 inline-flex">
                        <button 
                          onClick={() => setActiveDeck('A')}
                          className={`relative overflow-hidden px-8 py-2.5 rounded-md text-[10px] font-black tracking-[0.2em] transition-all duration-300 ${activeDeck === 'A' ? 'bg-[#7000ff] text-white shadow-[0_0_25px_rgba(112,0,255,0.5)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                        >
                          DECK A
                          {activeDeck === 'A' && <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none"></div>}
                        </button>
                        <button 
                          onClick={() => setActiveDeck('B')}
                          className={`relative overflow-hidden px-8 py-2.5 rounded-md text-[10px] font-black tracking-[0.2em] transition-all duration-300 ${activeDeck === 'B' ? 'bg-[#00d4ff] text-white shadow-[0_0_25px_rgba(0,212,255,0.5)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                        >
                          DECK B
                          {activeDeck === 'B' && <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none"></div>}
                        </button>
                    </div>
                 </div>

                 <div className="flex-1 flex flex-col items-center max-w-md w-full px-4 space-y-4">
                    <div className="flex justify-between w-full text-[9px] font-black text-gray-500 tracking-[0.3em]">
                       <span className={activeDeck === 'A' ? 'text-white' : ''}>A_SOURCE</span>
                       <span className="text-accent">X_FADER</span>
                       <span className={activeDeck === 'B' ? 'text-white' : ''}>B_SOURCE</span>
                    </div>
                    <div className="relative w-full group">
                        <input 
                          type="range" min="0" max="1" step="0.01" 
                          value={crossfader}
                          onChange={(e) => setCrossfader(parseFloat(e.target.value))}
                          className="w-full h-2 bg-black rounded-full appearance-none cursor-ew-resize accent-white border border-white/10 group-hover:border-white/30 transition-colors"
                        />
                        <div className="absolute -top-1 left-0 h-4 w-px bg-white/20"></div>
                        <div className="absolute -top-1 right-0 h-4 w-px bg-white/20"></div>
                        <div className="absolute -top-1 left-1/2 h-4 w-px bg-accent/50"></div>
                    </div>
                 </div>

                 <div className="flex flex-col gap-3">
                    <label className="text-[10px] text-gray-500 font-black tracking-[0.2em] uppercase text-center md:text-right">Clipboard</label>
                    <div className="flex gap-2">
                        <button 
                          onClick={copyDeck}
                          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black tracking-widest hover:bg-white/10 hover:border-white/40 transition-all flex items-center gap-2"
                          title="Copy current deck to the other one"
                        >
                          <i className="fas fa-copy text-accent"></i> CLONE
                        </button>
                        <div className="flex gap-1">
                            <button 
                              disabled={undoStack.length === 0}
                              onClick={undo}
                              className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 disabled:opacity-20 transition-all"
                            >
                              <i className="fas fa-undo"></i>
                            </button>
                            <button 
                              disabled={redoStack.length === 0}
                              onClick={redo}
                              className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 disabled:opacity-20 transition-all"
                            >
                              <i className="fas fa-redo"></i>
                            </button>
                        </div>
                    </div>
                 </div>
              </div>

              <SequencerGrid 
                tracks={tracks} 
                currentStep={currentStep} 
                toggleStep={toggleStep} 
                reorderTracks={reorderTracks}
                updateTrack={updateTrack}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tracks.map(track => (
                  <TrackControls 
                    key={track.id} 
                    track={track} 
                    updateTrack={updateTrack}
                    removeTrack={() => removeTrack(track.id)}
                  />
                ))}
              </div>

              <div className="pt-8 border-t border-white/5">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                  <div className="flex-1 w-full">
                    <h3 className="text-[10px] font-black text-gray-600 tracking-[0.3em] uppercase mb-5 flex items-center gap-2">
                       <i className="fas fa-plus-circle text-accent"></i>
                       Component Integration
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {TRACKS_CONFIG.map(template => (
                        <button 
                          key={template.type}
                          onClick={() => addTrack(template.type)}
                          className="px-6 py-2.5 bg-black/40 border border-white/5 rounded-lg text-[9px] font-black tracking-widest text-gray-500 hover:text-white hover:bg-accent/10 hover:border-accent/40 transition-all flex items-center gap-3 uppercase"
                        >
                          <i className="fas fa-microchip opacity-30"></i> {template.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 border border-white/5 rounded-xl bg-black/40 backdrop-blur-xl flex-[1.5] w-full">
                      <div className="space-y-2">
                          <div className="flex justify-between items-center text-[8px] text-gray-600 font-black tracking-widest uppercase">
                            <span>Master LPF</span>
                            <span className="text-white">{(settings.lpfFrequency / 1000).toFixed(1)}k</span>
                          </div>
                          <div className="relative h-1 bg-black rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="absolute top-0 left-0 h-full bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)] transition-all" 
                              style={{ width: `${(settings.lpfFrequency / 20000) * 100}%` }}
                            ></div>
                            <input 
                              type="range" min="100" max="20000" step="10" 
                              value={settings.lpfFrequency}
                              onChange={(e) => setSettings({...settings, lpfFrequency: parseInt(e.target.value)})}
                              className="absolute inset-0 w-full opacity-0 cursor-ew-resize"
                            />
                          </div>
                      </div>
                      <div className="space-y-2">
                          <div className="flex justify-between items-center text-[8px] text-gray-600 font-black tracking-widest uppercase">
                            <span>Master HPF</span>
                            <span className="text-white">{settings.hpfFrequency}Hz</span>
                          </div>
                          <div className="relative h-1 bg-black rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="absolute top-0 left-0 h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all" 
                              style={{ width: `${(settings.hpfFrequency / 5000) * 100}%` }}
                            ></div>
                            <input 
                              type="range" min="20" max="5000" step="1" 
                              value={settings.hpfFrequency}
                              onChange={(e) => setSettings({...settings, hpfFrequency: parseInt(e.target.value)})}
                              className="absolute inset-0 w-full opacity-0 cursor-ew-resize"
                            />
                          </div>
                      </div>
                      <div className="space-y-2">
                          <div className="flex justify-between items-center text-[8px] text-gray-600 font-black tracking-widest uppercase">
                            <span>Delay Send</span>
                            <span className="text-white">{Math.round(settings.delayFeedback * 100)}%</span>
                          </div>
                          <div className="relative h-1 bg-black rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="absolute top-0 left-0 h-full bg-pink-600 shadow-[0_0_10px_rgba(219,39,119,0.5)] transition-all" 
                              style={{ width: `${(settings.delayFeedback / 0.9) * 100}%` }}
                            ></div>
                            <input 
                              type="range" min="0" max="0.9" step="0.01" 
                              value={settings.delayFeedback}
                              onChange={(e) => setSettings({...settings, delayFeedback: parseFloat(e.target.value)})}
                              className="absolute inset-0 w-full opacity-0 cursor-ew-resize"
                            />
                          </div>
                      </div>
                      <div className="space-y-2">
                          <div className="flex justify-between items-center text-[8px] text-gray-600 font-black tracking-widest uppercase">
                            <span>Reverb Mix</span>
                            <span className="text-white">{Math.round(settings.reverbMix * 100)}%</span>
                          </div>
                          <div className="relative h-1 bg-black rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="absolute top-0 left-0 h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)] transition-all" 
                              style={{ width: `${(settings.reverbMix / 0.5) * 100}%` }}
                            ></div>
                            <input 
                              type="range" min="0" max="0.5" step="0.01" 
                              value={settings.reverbMix}
                              onChange={(e) => setSettings({...settings, reverbMix: parseFloat(e.target.value)})}
                              className="absolute inset-0 w-full opacity-0 cursor-ew-resize"
                            />
                          </div>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resize Handle */}
          <div 
            className="hidden md:block w-1 hover:w-2 bg-white/5 hover:bg-accent/40 cursor-col-resize transition-all z-20"
            onMouseDown={startResizing}
          />

          <div 
            className={`flex flex-col border-l border-white/5 bg-black/60 relative ${isVisualizerFullscreen ? 'fixed inset-0 z-[100] w-full h-full' : ''}`}
            style={{ width: isVisualizerFullscreen ? '100%' : `${rightPanelWidth}px` }}
          >
            {/* Panel Header/Tabs */}
            <div className="flex border-b border-white/5">
              <button 
                onClick={() => setActiveRightTab('VISUALS')}
                className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-all ${activeRightTab === 'VISUALS' ? 'bg-white/5 text-accent border-b border-accent' : 'text-gray-500 hover:bg-white/5'}`}
              >
                Visualizer
              </button>
              <button 
                onClick={() => setActiveRightTab('AI')}
                className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-all ${activeRightTab === 'AI' ? 'bg-white/5 text-accent border-b border-accent' : 'text-gray-500 hover:bg-white/5'}`}
              >
                AI Assistant
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              {activeRightTab === 'VISUALS' ? (
                <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
                   {showVisuals ? (
                     <BackgroundVisualizer analyzer={analyzer} settings={visualSettings} />
                   ) : (
                     <div className="absolute inset-0 bg-black flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                           <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className="w-full h-full bg-accent/20"></div>
                           </div>
                           <span className="text-[9px] font-black text-gray-700 tracking-[0.4em] uppercase">Visuals_Engaged_Offline</span>
                        </div>
                     </div>
                   )}
                   <div className="absolute top-4 right-4 z-20 flex gap-2">
                     <button 
                        onClick={() => setIsVisualizerFullscreen(!isVisualizerFullscreen)}
                        className="p-2 bg-black/60 border border-white/10 rounded-md text-[10px] hover:border-accent hover:text-accent transition-all backdrop-blur-sm"
                        title={isVisualizerFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                     >
                        <i className={`fas ${isVisualizerFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                     </button>
                   </div>
                   
                   {/* Modulator Panel */}
                   {showVisuals && (
                     <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-4 border border-white/10 rounded-lg backdrop-blur-md z-20 max-h-[40%] overflow-y-auto">
                      <div className="flex justify-between items-center mb-3">
                         <h3 className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">Visual Modulator</h3>
                         <div className="flex gap-1">
                            {(['NEON', 'ACID', 'MONO', 'EMBER'] as VisualPalette[]).map(p => (
                                <button 
                                    key={p}
                                    onClick={() => setVisualSettings({...visualSettings, palette: p})}
                                    className={`w-3 h-3 rounded-full border transition-all ${visualSettings.palette === p ? 'border-white scale-125' : 'border-white/10'}`}
                                    style={{ backgroundColor: p === 'NEON' ? '#7000ff' : p === 'ACID' ? '#80ff00' : p === 'MONO' ? '#ffffff' : '#ff8000' }}
                                />
                            ))}
                         </div>
                      </div>
                      
                      <div className="space-y-4">
                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-gray-500 uppercase font-bold">
                               <span>Grid Displacement</span>
                               <span className="text-white">{visualSettings.gridDisplacement.toFixed(2)}</span>
                            </div>
                            <input 
                               type="range" min="0" max="3" step="0.1" 
                               value={visualSettings.gridDisplacement}
                               onChange={(e) => setVisualSettings({...visualSettings, gridDisplacement: parseFloat(e.target.value)})}
                               className="w-full accent-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                         </div>

                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-gray-500 uppercase font-bold">
                               <span>Ray Intensity</span>
                               <span className="text-white">{visualSettings.rayIntensity.toFixed(2)}</span>
                            </div>
                            <input 
                               type="range" min="0" max="3" step="0.1" 
                               value={visualSettings.rayIntensity}
                               onChange={(e) => setVisualSettings({...visualSettings, rayIntensity: parseFloat(e.target.value)})}
                               className="w-full accent-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                         </div>

                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-gray-500 uppercase font-bold">
                               <span>Sensitivity</span>
                               <span className="text-white">{visualSettings.sensitivity.toFixed(2)}</span>
                            </div>
                            <input 
                               type="range" min="0" max="3" step="0.1" 
                               value={visualSettings.sensitivity}
                               onChange={(e) => setVisualSettings({...visualSettings, sensitivity: parseFloat(e.target.value)})}
                               className="w-full accent-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                         </div>

                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-gray-500 uppercase font-bold">
                               <span>Particle Size</span>
                               <span className="text-white">{(visualSettings.particleSize * 100).toFixed(0)}%</span>
                            </div>
                            <input 
                               type="range" min="0.01" max="0.1" step="0.005" 
                               value={visualSettings.particleSize}
                               onChange={(e) => setVisualSettings({...visualSettings, particleSize: parseFloat(e.target.value)})}
                               className="w-full accent-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                         </div>

                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-gray-500 uppercase font-bold">
                               <span>Speed</span>
                               <span className="text-white">{(visualSettings.rotationSpeed * 1000).toFixed(0)}</span>
                            </div>
                            <input 
                               type="range" min="0.0001" max="0.01" step="0.0001" 
                               value={visualSettings.rotationSpeed}
                               onChange={(e) => setVisualSettings({...visualSettings, rotationSpeed: parseFloat(e.target.value)})}
                               className="w-full accent-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                         </div>

                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-gray-500 uppercase font-bold">
                               <span>Kick Flash Blur</span>
                               <span className="text-white">{visualSettings.blurAmount.toFixed(2)}</span>
                            </div>
                            <input 
                               type="range" min="0" max="2" step="0.1" 
                               value={visualSettings.blurAmount}
                               onChange={(e) => setVisualSettings({...visualSettings, blurAmount: parseFloat(e.target.value)})}
                               className="w-full accent-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                         </div>

                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-gray-500 uppercase font-bold">
                               <span>Hue Shift</span>
                               <span className="text-white">{(visualSettings.hueShift * 360).toFixed(0)}°</span>
                            </div>
                            <input 
                               type="range" min="0" max="1" step="0.01" 
                               value={visualSettings.hueShift}
                               onChange={(e) => setVisualSettings({...visualSettings, hueShift: parseFloat(e.target.value)})}
                               className="w-full accent-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                         </div>

                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-gray-500 uppercase font-bold">
                               <span>Trail Intensity</span>
                               <span className="text-white">{(visualSettings.trailIntensity * 100).toFixed(0)}%</span>
                            </div>
                            <input 
                               type="range" min="0" max="0.99" step="0.01" 
                               value={visualSettings.trailIntensity}
                               onChange={(e) => setVisualSettings({...visualSettings, trailIntensity: parseFloat(e.target.value)})}
                               className="w-full accent-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                         </div>

                         <div className="flex items-center justify-between py-2">
                            <div className="space-y-1 flex-1 pr-4">
                               <div className="flex justify-between text-[8px] text-gray-500 uppercase font-bold mb-1">
                                  <span>Kaleidoscope</span>
                                  <span className="text-white">{visualSettings.kaleidoscopeTiles}x</span>
                               </div>
                               <input 
                                  type="range" min="1" max="12" step="1" 
                                  value={visualSettings.kaleidoscopeTiles}
                                  onChange={(e) => setVisualSettings({...visualSettings, kaleidoscopeTiles: parseInt(e.target.value)})}
                                  className="w-full accent-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                               />
                            </div>
                            <button 
                               onClick={() => setVisualSettings({...visualSettings, mirrorMode: !visualSettings.mirrorMode})}
                               className={`px-3 py-1 rounded border text-[8px] font-bold uppercase transition-all ${visualSettings.mirrorMode ? 'bg-accent text-black border-accent' : 'bg-white/5 text-gray-500 border-white/10'}`}
                            >
                               Mirror
                            </button>
                         </div>
                      </div>
                   </div>
                   )}
                   {showVisuals && !analyzer && (
                     <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-[10px] uppercase tracking-widest animate-pulse">
                        Start audio to visualize
                     </div>
                   )}
                </div>
              ) : (
                <AIAssistant settings={settings} onApplyPattern={applySuggestedPattern} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
