/**
 * Environment Configuration
 *
 * Centralized environment variable handling for secure configuration
 * Ensures API keys are never exposed in the browser
 */

export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isVercelDeployment: boolean;
  apiProxyUrl: string;
  groqModelId: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Get environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const isDevelopment = import.meta.env.DEV;
  const isProduction = import.meta.env.PROD;
  const isVercelDeployment =
    typeof window !== "undefined"
      ? window.location.hostname.includes("vercel.app")
      : false;

  return {
    isDevelopment,
    isProduction,
    isVercelDeployment,
    apiProxyUrl: "/api/groq-proxy",
    groqModelId: "llama-3.3-70b-versatile",
    maxTokens: 1024,
    temperature: 0.7,
  };
}

/**
 * Validate environment setup
 */
export function validateEnvironmentSetup(): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  const config = getEnvironmentConfig();

  if (config.isDevelopment) {
    // Development environment checks
    const apiKeyPresent =
      typeof process !== "undefined" ? !!process.env.GROQ_API_KEY : false;

    if (!apiKeyPresent) {
      warnings.push("⚠️ GROQ_API_KEY not set. AI features will be limited.");
    }
  } else {
    // Production environment checks
    if (!config.isVercelDeployment) {
      warnings.push(
        "⚠️ Not detected as Vercel deployment. Ensure API proxy is configured.",
      );
    }
  }

  // Always check for secure connection in production
  if (config.isProduction && typeof window !== "undefined") {
    if (!window.location.protocol.startsWith("https")) {
      errors.push("❌ Production deployment must use HTTPS");
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Log environment configuration
 */
export function logEnvironmentConfig(): void {
  const config = getEnvironmentConfig();
  const validation = validateEnvironmentSetup();

  console.group("🔧 Environment Configuration");
  console.log("Mode:", config.isDevelopment ? "Development" : "Production");
  console.log("Vercel Deployment:", config.isVercelDeployment);
  console.log("API Proxy:", config.apiProxyUrl);
  console.log("Model:", config.groqModelId);

  if (validation.warnings.length > 0) {
    console.group("Warnings");
    validation.warnings.forEach((w) => console.warn(w));
    console.groupEnd();
  }

  if (validation.errors.length > 0) {
    console.group("Errors");
    validation.errors.forEach((e) => console.error(e));
    console.groupEnd();
  }

  console.groupEnd();
}

// Initialize on module load
if (typeof window !== "undefined") {
  logEnvironmentConfig();
}
