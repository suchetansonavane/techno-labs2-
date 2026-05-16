
import React from 'react';
import { AudioSettings } from '../types';

interface HeaderProps {
  isPlaying: boolean;
  togglePlay: () => void;
  settings: AudioSettings;
  setSettings: (s: AudioSettings) => void;
  toggleRecording: () => void;
  isRecording: boolean;
  onSaveProject: () => void;
  onLoadProject: (file: File) => void;
  showVisuals: boolean;
  onToggleVisuals: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  isPlaying, 
  togglePlay, 
  settings, 
  setSettings, 
  toggleRecording, 
  isRecording,
  onSaveProject,
  onLoadProject,
  showVisuals,
  onToggleVisuals
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadProject(file);
    }
  };

  return (
    <header className="h-16 bg-black border-b border-white/10 flex items-center justify-between px-6 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-black tracking-[0.3em] text-white flex items-center gap-3">
            <div className="relative">
              <span className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-25"></span>
              <span className="relative block w-2.5 h-2.5 bg-red-600 rounded-full"></span>
            </div>
            NEON_TECHNO_LAB
        </h1>
        
        <div className="flex items-center gap-1 md:gap-2 ml-2 md:ml-6 border-l border-white/5 pl-4">
          <button 
            onClick={onSaveProject}
            className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg active:scale-95"
            title="Export Project"
          >
            <i className="fas fa-download text-sm"></i>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg active:scale-95"
            title="Import Project"
          >
            <i className="fas fa-upload text-sm"></i>
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 lg:gap-8">
        <div className="flex items-center gap-2 md:gap-3">
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">BPM</label>
          <div className="flex items-center gap-2">
             <input 
                type="number" 
                value={settings.bpm}
                onChange={(e) => setSettings({...settings, bpm: Math.max(60, Math.min(200, parseInt(e.target.value) || 0))})}
                className="bg-gray-900 border border-white/20 text-white text-sm rounded px-2 py-1 w-16 text-center focus:outline-none focus:border-accent"
             />
             <input 
                type="range" min="60" max="200" step="1" 
                value={settings.bpm}
                onChange={(e) => setSettings({...settings, bpm: parseInt(e.target.value)})}
                className="w-24 accent-purple-600 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer hidden md:block"
             />
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Swing</label>
          <input 
                type="range" min="0" max="100" step="1" 
                value={settings.swing}
                onChange={(e) => setSettings({...settings, swing: parseInt(e.target.value)})}
                className="w-12 md:w-16 accent-purple-600 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="hidden md:flex items-center gap-3">
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Delay</label>
          <input 
                type="range" min="0" max="0.9" step="0.01" 
                value={settings.delayFeedback}
                onChange={(e) => setSettings({...settings, delayFeedback: parseFloat(e.target.value)})}
                className="w-12 md:w-16 accent-pink-600 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <button 
          onClick={onToggleVisuals}
          className={`px-4 py-1.5 text-[9px] font-black tracking-widest border transition-all flex items-center gap-2 rounded-md ${showVisuals ? 'bg-accent/20 border-accent/40 text-white' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/30 hover:bg-white/5'}`}
        >
          <i className={`fas ${showVisuals ? 'fa-eye' : 'fa-eye-slash'}`}></i>
          {showVisuals ? 'VIS_ON' : 'VIS_OFF'}
        </button>

        <button 
          onClick={toggleRecording}
          className={`px-4 py-1.5 text-[9px] font-black tracking-widest border transition-all flex items-center gap-2 rounded-md ${isRecording ? 'bg-red-600 text-white border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-transparent text-white border-white/10 hover:border-white/30 hover:bg-white/5'}`}
        >
          <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white animate-pulse' : 'bg-red-600'}`}></span>
          {isRecording ? 'STOP_REC' : 'SAV_TRACK'}
        </button>

        <button 
          onClick={togglePlay}
          className={`flex items-center gap-3 px-8 py-2 font-black text-[11px] tracking-[0.3em] transition-all rounded-md shadow-lg overflow-hidden relative group ${isPlaying ? 'bg-red-600 text-white' : 'bg-white text-black hover:bg-accent hover:text-white'}`}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          {isPlaying ? <><i className="fas fa-stop text-[10px]"></i> STOP_LAB</> : <><i className="fas fa-play text-[10px]"></i> START_LAB</>}
        </button>
      </div>
    </header>
  );
};

export default Header;
