import React, { useState, useEffect, useRef } from "react";
import { groqService, SuggestedPattern } from "../services/groqService";
import { AudioSettings } from "../types";

interface AIAssistantProps {
  settings: AudioSettings;
  onApplyPattern?: (instrument: string, steps: boolean[]) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  settings,
  onApplyPattern,
}) => {
  const [tips, setTips] = useState<string>("");
  const [sources, setSources] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState<SuggestedPattern | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const getAssistantFeedback = async () => {
    setLoading(true);
    setSuggestion(null);
    const result = await groqService.getProductionTips(
      "Berghain Minimal",
      settings,
    );
    setTips(result.text);
    setSources(result.sources);
    setLoading(false);

    // Auto-speak the first tip
    if (result.text) {
      groqService.speakAnalysis(result.text.split("\n")[0]);
    }
  };

  const getPatternIdea = async () => {
    setLoading(true);
    setTips("");
    const pattern = await groqService.getPatternSuggestion(
      "Hard Techno",
      settings.bpm,
    );
    setSuggestion(pattern);
    setLoading(false);
    if (pattern) {
      groqService.speakAnalysis(
        `I've found a new ${pattern.instrumentType} pattern called ${pattern.patternName}. It's ready to apply.`,
      );
    }
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-xs font-bold tracking-[0.3em] text-white flex items-center gap-2">
          <i className="fas fa-microchip text-accent"></i>
          AI PRODUCER
        </h2>
        <p className="text-[10px] text-gray-500 uppercase leading-relaxed">
          Real-time production consulting powered by Gemini.
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
        {loading ? (
          <div className="space-y-4 w-full">
            <div className="h-4 bg-white/5 animate-pulse rounded w-full"></div>
            <div className="h-4 bg-white/5 animate-pulse rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-white/5 animate-pulse rounded w-5/6 mx-auto"></div>
          </div>
        ) : tips ? (
          <div className="bg-white/5 border border-white/10 p-4 rounded text-left animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="text-[11px] leading-relaxed text-gray-300 font-light whitespace-pre-line">
              {tips}
            </div>
            {sources.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-2">
                <button
                  onClick={() => setShowSources(!showSources)}
                  className="text-[9px] text-accent hover:underline uppercase"
                >
                  {showSources
                    ? "Hide Sources"
                    : `View ${sources.length} Sources`}
                </button>
                {showSources && (
                  <ul className="mt-2 space-y-1">
                    {sources.map((url, i) => (
                      <li key={i} className="truncate">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[8px] text-gray-500 hover:text-white"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : suggestion ? (
          <div className="bg-white/5 border border-accent/20 p-4 rounded text-left animate-in zoom-in duration-500 space-y-3">
            <div>
              <span className="text-[9px] text-accent font-bold uppercase block mb-1">
                Generated Pattern
              </span>
              <h3 className="text-xs font-bold text-white uppercase">
                {suggestion.patternName}
              </h3>
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed italic">
                "{suggestion.advice}"
              </p>
            </div>

            <div className="flex gap-[2px] h-3">
              {suggestion.steps.map((s, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${s ? "bg-accent shadow-[0_0_5px_rgba(112,0,255,0.5)]" : "bg-white/5"}`}
                ></div>
              ))}
            </div>

            <button
              onClick={() =>
                onApplyPattern?.(
                  suggestion.instrumentType.toLowerCase(),
                  suggestion.steps,
                )
              }
              className="w-full py-2 bg-accent text-white text-[10px] font-bold uppercase rounded hover:bg-white hover:text-black transition-all"
            >
              Apply to {suggestion.instrumentType}
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-gray-600 italic">
            Consult Gemini for patterns or production feedback.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <button
          onClick={getPatternIdea}
          disabled={loading}
          className="w-full py-4 border border-accent/40 text-accent text-xs font-bold tracking-widest hover:bg-accent hover:text-white transition-all rounded"
        >
          {loading ? "GENERATING..." : "SUGGEST PATTERN"}
        </button>
        <button
          onClick={getAssistantFeedback}
          disabled={loading}
          className="w-full py-3 bg-white/5 border border-white/10 text-gray-400 text-[10px] font-bold tracking-widest hover:border-white hover:text-white transition-all rounded"
        >
          {loading ? "ANALYZING..." : "ANALYZE VIBE"}
        </button>
        <p className="text-[8px] text-center text-gray-700 uppercase tracking-widest mt-2">
          Assistant can access Google Search for latest trends
        </p>
      </div>
    </div>
  );
};

export default AIAssistant;
