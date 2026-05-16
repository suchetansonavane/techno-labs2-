/**
 * Groq Service - Proxy-based Implementation (SECURE)
 *
 * This service communicates with Groq API through a secure backend proxy.
 * The API key never leaves the server, protecting your account from exposure.
 *
 * In development: Falls back to direct API calls (with warning)
 * In production: Uses Vercel Edge Function proxy (/api/groq-proxy)
 */

export interface SuggestedPattern {
  instrumentType: string;
  patternName: string;
  steps: boolean[];
  advice: string;
}

export interface ProductionTips {
  text: string;
  sources: string[];
}

interface GroqMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  _metadata?: {
    proxied: boolean;
    timestamp: string;
  };
}

/**
 * GroqService handles all AI-powered features through secure proxy
 */
export class GroqService {
  private apiKey: string | null;
  private proxyUrl: string;
  private isDevelopment: boolean;

  constructor() {
    // Get API key from environment (only available in development)
    this.apiKey =
      typeof process !== "undefined" ? process.env.GROQ_API_KEY || null : null;

    // In production on Vercel, use proxy endpoint
    this.proxyUrl = "/api/groq-proxy";

    // Detect environment
    this.isDevelopment =
      typeof window === "undefined"
        ? true
        : !window.location.hostname.includes("vercel.app");

    if (this.isDevelopment && !this.apiKey) {
      console.warn("⚠️ GROQ_API_KEY not set. AI features will be limited.");
    }
  }

  /**
   * Call Groq API through proxy (production) or direct (development)
   */
  private async callGroqAPI(
    messages: GroqMessage[],
  ): Promise<GroqResponse | null> {
    try {
      // In production (Vercel), use the proxy endpoint
      if (!this.isDevelopment) {
        return await this.callProxyAPI(messages);
      }

      // In development, try proxy first, fall back to direct API
      try {
        return await this.callProxyAPI(messages);
      } catch (proxyError) {
        console.log("Proxy not available, using direct API call (dev only)");
        return await this.callDirectAPI(messages);
      }
    } catch (error) {
      console.error("Error calling Groq API:", error);
      return null;
    }
  }

  /**
   * Call through secure proxy endpoint
   */
  private async callProxyAPI(messages: GroqMessage[]): Promise<GroqResponse> {
    const response = await fetch(this.proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Proxy API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Direct API call (development/fallback only)
   * ⚠️ WARNING: This exposes API key in browser environment
   * Should only be used in development or for testing
   */
  private async callDirectAPI(messages: GroqMessage[]): Promise<GroqResponse> {
    if (!this.apiKey) {
      throw new Error("GROQ_API_KEY not configured");
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `Groq API error: ${response.status}`,
      );
    }

    return response.json();
  }

  /**
   * Get production tips for a specific genre and BPM
   */
  async getProductionTips(
    genre: string = "techno",
    currentSettings?: any,
  ): Promise<ProductionTips> {
    const bpm = currentSettings?.bpm || 128;

    const prompt = `You are an expert music producer specializing in ${genre} music. 
Provide 3 specific, actionable production tips for creating ${genre} music at ${bpm} BPM.
Format: 
- Tip 1: [detailed advice]
- Tip 2: [detailed advice]
- Tip 3: [detailed advice]

Focus on practical advice that can be implemented immediately.`;

    const messages: GroqMessage[] = [
      {
        role: "system",
        content:
          "You are an expert music producer. Provide concise, actionable production advice.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    const response = await this.callGroqAPI(messages);

    if (!response || !response.choices?.[0]) {
      return {
        text: this.getFallbackProductionTips(genre),
        sources: [],
      };
    }

    const tipText = response.choices[0].message.content;

    return {
      text: tipText,
      sources: ["Groq LLaMA 3.3-70B", `Genre: ${genre}`, `BPM: ${bpm}`],
    };
  }

  /**
   * Get a pattern suggestion for a specific instrument
   */
  async getPatternSuggestion(
    genre: string = "techno",
    bpm: number = 128,
  ): Promise<SuggestedPattern | null> {
    const prompt = `Suggest a professional 16-step drum pattern for ${genre} at ${bpm} BPM.
Choose one instrument: kick, bass, snare, hihat, or sitar.
Respond ONLY with valid JSON (no markdown):
{
  "instrumentType": "one of: kick, bass, snare, hihat, sitar",
  "patternName": "creative pattern name",
  "steps": [true/false for each of 16 steps],
  "advice": "one sentence describing the pattern"
}`;

    const messages: GroqMessage[] = [
      {
        role: "system",
        content:
          "You are a drum machine expert. Return ONLY valid JSON, no markdown formatting or explanations.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    try {
      const response = await this.callGroqAPI(messages);

      if (!response || !response.choices?.[0]) {
        return null;
      }

      const content = response.choices[0].message.content;

      // Extract JSON from response (in case of markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const pattern = JSON.parse(jsonMatch[0]) as SuggestedPattern;

      // Validate pattern has 16 steps
      if (!Array.isArray(pattern.steps) || pattern.steps.length !== 16) {
        return null;
      }

      return pattern;
    } catch (error) {
      console.error("Pattern generation error:", error);
      return null;
    }
  }

  /**
   * Generate creative ideas for the next musical phrase
   */
  async generateAIIdeas(settings?: any): Promise<string | null> {
    const bpm = settings?.bpm || 128;
    const genre = settings?.genre || "techno";

    const prompt = `You are a creative music producer. Generate 3 ideas for the next musical phrase in ${genre} at ${bpm} BPM.
Format as:
- Idea 1: [brief description]
- Idea 2: [brief description]
- Idea 3: [brief description]`;

    const messages: GroqMessage[] = [
      {
        role: "system",
        content:
          "You are a creative music producer providing quick, actionable ideas.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    const response = await this.callGroqAPI(messages);

    if (!response || !response.choices?.[0]) {
      return null;
    }

    return response.choices[0].message.content;
  }

  /**
   * Fallback production tips (when API is unavailable)
   */
  private getFallbackProductionTips(genre: string): string {
    const tips: Record<string, string> = {
      techno: `🎵 Techno Production Tips:
- Use a steady 4/4 beat with 808-style kicks at 120-140 BPM
- Layer filtered hi-hats for movement and energy
- Add subtle reverb and delay for spatial depth
- Automate filter sweeps for hypnotic tension building
- Use sidechain compression on the synths to create pulse`,

      house: `🏠 House Production Tips:
- Build grooves around a 4x4 beat foundation
- Use chopped vocal samples for interest
- Layer pads with long reverb for atmosphere
- Add swing to hi-hats (around 50ms offset)
- Keep low-end punchy with filtered sub-bass`,

      ambient: `🌌 Ambient Production Tips:
- Use long reverb tails and slow modulation
- Layer multiple pads with slight detuning
- Add gentle filter sweeps for evolution
- Use sidechain compression subtly
- Leave space and silence for breathing room`,

      default: `🎸 General Production Tips:
- Start with a strong kick and bassline foundation
- Add complementary melodic elements gradually
- Use EQ to create space between instruments
- Apply reverb and delay tastefully for depth
- Automate parameters to maintain listener interest`,
    };

    return tips[genre.toLowerCase()] || tips.default;
  }

  /**
   * TTS not available with Groq (deprecated method)
   */
  async speakAnalysis(text: string): Promise<ArrayBuffer | null> {
    console.warn(
      "TTS not available with Groq. Use a dedicated TTS API (ElevenLabs, Google TTS, etc.)",
    );
    return null;
  }
}

export const groqService = new GroqService();
