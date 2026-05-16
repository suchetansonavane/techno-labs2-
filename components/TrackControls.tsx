
import React from 'react';
import { TrackState } from '../types';
import { COLORS } from '../constants';

interface TrackControlsProps {
  track: TrackState;
  updateTrack: (id: string, updates: Partial<TrackState>) => void;
  removeTrack: () => void;
}

const TrackControls: React.FC<TrackControlsProps> = ({ track, updateTrack, removeTrack }) => {
  const color = COLORS[track.type] || '#fff';

  const getPitchBounds = () => {
    if (track.type === 'kick' || track.type === 'kick2' || track.type === 'bass') {
      return { min: 20, max: 200 };
    }
    return { min: 200, max: 12000 };
  };

  const { min, max } = getPitchBounds();

  return (
    <div className="bg-[#0c0c0c] border border-white/5 p-5 rounded-xl space-y-5 shadow-inner group hover:border-white/20 transition-all hover:bg-[#111]">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}></div>
            <h3 className="text-[10px] font-black tracking-[0.2em] truncate uppercase" style={{ color }}>{track.name}</h3>
        </div>
        <div className="flex gap-1 shrink-0">
          <button 
            onClick={() => updateTrack(track.id, { isSoloed: !track.isSoloed })}
            className={`text-[8px] px-2 py-0.5 rounded font-black border transition-all ${track.isSoloed ? 'bg-yellow-600 border-yellow-500 text-black' : 'bg-transparent border-white/5 text-gray-600 hover:text-gray-400'}`}
          >
            S
          </button>
          <button 
            onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
            className={`text-[8px] px-2 py-0.5 rounded font-black border transition-all ${track.isMuted ? 'bg-red-600 border-red-500 text-white' : 'bg-transparent border-white/5 text-gray-600 hover:text-gray-400'}`}
          >
            M
          </button>
          <button 
            onClick={removeTrack}
            className="text-[8px] px-2 py-0.5 rounded font-black border border-white/5 text-gray-600 hover:bg-white hover:text-black transition-all"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-[8px] text-gray-600 font-black uppercase tracking-widest">
            <span>Volume</span>
            <span className="text-white">{Math.round(track.volume * 100)}%</span>
          </div>
          <div className="relative h-1 bg-black rounded-full overflow-hidden border border-white/5">
            <div 
              className="absolute top-0 left-0 h-full bg-white transition-all duration-200" 
              style={{ width: `${track.volume * 100}%` }}
            ></div>
            <input 
                type="range" min="0" max="1" step="0.01" 
                value={track.volume}
                onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
                className="absolute inset-0 w-full opacity-0 cursor-ew-resize"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[8px] text-gray-600 font-black uppercase tracking-widest">
            <span>Decay</span>
            <span className="text-white">{track.decay.toFixed(2)}s</span>
          </div>
          <div className="relative h-1 bg-black rounded-full overflow-hidden border border-white/5">
            <div 
              className="absolute top-0 left-0 h-full bg-white/40 transition-all duration-200" 
              style={{ width: `${(track.decay / 1.5) * 100}%` }}
            ></div>
            <input 
                type="range" min="0.01" max="1.5" step="0.01" 
                value={track.decay}
                onChange={(e) => updateTrack(track.id, { decay: parseFloat(e.target.value) })}
                className="absolute inset-0 w-full opacity-0 cursor-ew-resize"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[8px] text-gray-600 font-black uppercase tracking-widest">
            <span>Frequency</span>
            <span className="text-white">{track.pitch}Hz</span>
          </div>
          <div className="relative h-1 bg-black rounded-full overflow-hidden border border-white/5">
            <div 
              className="absolute top-0 left-0 h-full bg-white/20 transition-all duration-200" 
              style={{ width: `${((track.pitch - min) / (max - min)) * 100}%` }}
            ></div>
            <input 
                type="range" min={min} max={max} step="1" 
                value={track.pitch}
                onChange={(e) => updateTrack(track.id, { pitch: parseInt(e.target.value) })}
                className="absolute inset-0 w-full opacity-0 cursor-ew-resize"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackControls;
