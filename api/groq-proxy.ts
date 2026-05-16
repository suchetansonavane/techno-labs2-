import type { VercelRequest, VercelResponse } from "@vercel/node";

// Rate limiting: Simple in-memory store for this request
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // Groq free tier limit

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Check rate limit for a given key (IP or user identifier)
 * Returns true if request is allowed, false if rate limited
 */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // New window or expired window
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (entry.count < RATE_LIMIT_MAX) {
    entry.count++;
    return true;
  }

  return false;
}

/**
 * Get client IP from request headers
 */
function getClientIP(req: VercelRequest): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    "unknown"
  );
}

/**
 * Main handler for Groq API proxy
 * Proxies chat/completions requests to Groq API
 * Keeps API key secure on server-side
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(req);

    // Check rate limit (30 requests per minute per IP)
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({
        error: "Rate limit exceeded. Maximum 30 requests per minute.",
        retryAfter: 60,
      });
    }

    // Get API key from environment
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("GROQ_API_KEY not configured in environment");
      return res.status(500).json({
        error: "API key not configured on server",
      });
    }

    // Extract request body
    const {
      messages,
      model = "llama-3.3-70b-versatile",
      max_tokens = 1024,
      temperature = 0.7,
    } = req.body;

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "Invalid request: messages array required",
      });
    }

    // Call Groq API with secure server-side API key
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens,
          temperature,
        }),
      },
    );

    // Check if Groq API returned an error
    if (!groqResponse.ok) {
      const errorData = await groqResponse.json().catch(() => ({}));
      console.error("Groq API error:", errorData);

      return res.status(groqResponse.status).json({
        error: errorData.error?.message || "Groq API error",
        status: groqResponse.status,
      });
    }

    // Parse Groq response
    const data = await groqResponse.json();

    // Add metadata to response
    const responseWithMetadata = {
      ...data,
      _metadata: {
        proxied: true,
        timestamp: new Date().toISOString(),
        clientIP: clientIP,
      },
    };

    // Return successful response with caching headers
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    return res.status(200).json(responseWithMetadata);
  } catch (error) {
    // Handle unexpected errors
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Proxy handler error:", errorMessage);

    return res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development" ? errorMessage : undefined,
    });
  }
}
