
import React, { useState } from 'react';
import { TrackState } from '../types';
import { COLORS } from '../constants';

interface SequencerGridProps {
  tracks: TrackState[];
  currentStep: number;
  toggleStep: (trackId: string, stepIndex: number) => void;
  reorderTracks: (startIndex: number, endIndex: number) => void;
  updateTrack: (trackId: string, updates: Partial<TrackState>) => void;
}

const SequencerGrid: React.FC<SequencerGridProps> = ({ tracks, currentStep, toggleStep, reorderTracks, updateTrack }) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    // Standard visual for drag
    e.dataTransfer.effectAllowed = 'move';
    // To make sure Firefox allows dragging
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const onDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const onDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      reorderTracks(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-2 relative">
      {/* Step Numbers */}
      <div className="flex mb-1">
        <div className="w-32 shrink-0"></div> 
        <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] flex-1 gap-1">
          {Array.from({ length: 16 }).map((_, i) => (
            <div 
              key={i} 
              className={`text-[8px] text-center transition-colors duration-150 font-black tracking-tighter ${currentStep === i ? 'text-white' : 'text-gray-700'}`}
            >
              {(i % 4 === 0) ? '•' : ''}
              {String(i + 1).padStart(2, '0')}
            </div>
          ))}
        </div>
      </div>
      
      {/* Grid Container */}
      <div className="relative">
        {/* The Progressive Scanning Line */}
        <div 
          className="absolute top-0 bottom-0 w-[2px] bg-white z-10 pointer-events-none scanner-line"
          style={{
            left: `calc(8rem + 1rem + ${(currentStep / 16) * 100}%)`,
            boxShadow: '0 0 15px 2px rgba(255, 255, 255, 0.6)',
            opacity: 0.8,
            marginLeft: '-1px'
          }}
        />

        {tracks.map((track, index) => {
          const isDragging = draggedIndex === index;
          const isOver = dragOverIndex === index;

          return (
            <div 
              key={track.id} 
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragEnter={(e) => onDragEnter(e, index)}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              className={`
                flex items-center gap-4 mb-2 transition-all duration-200
                ${isDragging ? 'opacity-30' : 'opacity-100'}
                ${isOver && draggedIndex !== index ? 'border-t-2 border-accent mt-2' : ''}
              `}
            >
              <div className="flex items-center gap-1 w-32 shrink-0">
                <div className="cursor-grab active:cursor-grabbing p-1 text-gray-600 hover:text-white transition-colors">
                  <i className="fas fa-grip-vertical text-[8px]"></i>
                </div>
                
                <div className="flex flex-col flex-1 min-w-0">
                  <div 
                    className={`text-[9px] font-black tracking-widest uppercase truncate transition-colors ${track.isMuted ? 'text-gray-700' : 'text-gray-400'}`} 
                    title={track.name}
                  >
                    {track.name}
                  </div>
                  <div className="flex gap-1 mt-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTrack(track.id, { isSoloed: !track.isSoloed });
                      }}
                      className={`text-[7px] px-1.5 py-0 rounded-sm font-black border transition-all ${track.isSoloed ? 'bg-yellow-600 border-yellow-500 text-black' : 'bg-transparent border-white/5 text-gray-700 hover:text-gray-400'}`}
                    >
                      S
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTrack(track.id, { isMuted: !track.isMuted });
                      }}
                      className={`text-[7px] px-1.5 py-0 rounded-sm font-black border transition-all ${track.isMuted ? 'bg-red-600 border-red-500 text-white' : 'bg-transparent border-white/5 text-gray-700 hover:text-gray-400'}`}
                    >
                      M
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] flex-1 gap-1 relative">
                {track.steps.map((active, i) => {
                  const isHit = active && currentStep === i;
                  const color = COLORS[track.type] || '#ffffff';
                  
                  return (
                    <div 
                      key={i}
                      onClick={() => toggleStep(track.id, i)}
                      className={`
                        h-12 cursor-pointer border rounded-sm transition-all duration-75 relative
                        ${currentStep === i ? 'z-20 scale-y-110 shadow-lg' : 'z-0'}
                        ${active ? 'border-white/40' : 'border-white/5 hover:border-white/20 hover:bg-white/5'}
                        ${isHit ? 'animate-hit' : ''}
                      `}
                      style={{
                        backgroundColor: active ? color : (i % 4 === 0 ? '#101010' : '#080808'),
                        color: color, 
                        opacity: active ? (currentStep === i ? 1 : 0.9) : (currentStep === i ? 1 : 0.6),
                        boxShadow: active ? `0 0 20px ${color}44, inset 0 0 10px ${color}22` : 'none',
                      }}
                    >
                      {i % 4 === 0 && !active && <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-white/10"></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SequencerGrid;
