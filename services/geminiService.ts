
import { GoogleGenAI, Modality, Type } from "@google/genai";

// Initialize Gemini API client according to guidelines using process.env.API_KEY directly
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface SuggestedPattern {
  instrumentType: string;
  patternName: string;
  steps: boolean[];
  advice: string;
}

export class GeminiService {
  async getProductionTips(genre: string, currentSettings: any) {
    try {
      // Basic text tasks use gemini-3-flash-preview
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I am producing ${genre} techno. My current BPM is ${currentSettings.bpm}. Provide 3 short, punchy, professional production tips to make the sound more authentic.`,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });
      // Extract text from .text property and retrieve grounding URLs from groundingChunks
      return {
        text: response.text,
        sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => chunk.web?.uri).filter(Boolean) || []
      };
    } catch (err) {
      console.error("Gemini Error:", err);
      return { text: "Keep the low end tight and the hi-hats crisp.", sources: [] };
    }
  }

  async getPatternSuggestion(genre: string, bpm: number): Promise<SuggestedPattern | null> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest a professional 16-step sequencer pattern for a ${genre} track at ${bpm} BPM. Choose one instrument (kick, bass, snare, hihat, or sitar).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              instrumentType: { 
                type: Type.STRING, 
                description: "One of: kick, bass, snare, hihat, sitar" 
              },
              patternName: { type: Type.STRING },
              steps: { 
                type: Type.ARRAY, 
                items: { type: Type.BOOLEAN },
                description: "Exactly 16 boolean values"
              },
              advice: { type: Type.STRING }
            },
            required: ["instrumentType", "patternName", "steps", "advice"]
          }
        }
      });

      const jsonStr = response.text.trim();
      return JSON.parse(jsonStr) as SuggestedPattern;
    } catch (err) {
      console.error("Pattern Suggestion Error:", err);
      return null;
    }
  }

  async speakAnalysis(text: string) {
    try {
      // Text-to-speech tasks use gemini-2.5-flash-preview-tts
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say with a cool, deep techno-producer vibe: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      // Retrieve audio data from candidates parts inlineData
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        this.playPCM(base64Audio);
      }
    } catch (err) {
      console.error("TTS Error:", err);
    }
  }

  private async playPCM(base64: string) {
    // Standard logic to decode raw PCM audio data and play it via AudioContext
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }
}

export const gemini = new GeminiService();
