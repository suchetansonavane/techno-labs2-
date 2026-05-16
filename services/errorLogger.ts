/**
 * Error Handling & Logging Utility
 *
 * Provides centralized error handling for the application
 * with proper logging, user-friendly messages, and security
 */

export enum ErrorSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

export interface ErrorLog {
  timestamp: string;
  severity: ErrorSeverity;
  message: string;
  context?: Record<string, any>;
  userMessage?: string;
  stack?: string;
}

class ErrorLogger {
  private isDevelopment: boolean;
  private logs: ErrorLog[] = [];
  private maxLogs: number = 100;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
  }

  /**
   * Log an error with appropriate context
   */
  log(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    context?: Record<string, any>,
    userMessage?: string,
  ): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      severity,
      message,
      context: this.isDevelopment ? context : undefined,
      userMessage: userMessage || this.getDefaultUserMessage(severity),
      stack: this.isDevelopment ? new Error().stack : undefined,
    };

    // Store in memory (for sending to monitoring service later)
    this.logs.push(errorLog);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    this.consoleOutput(errorLog);

    // TODO: Send to monitoring service (Sentry, LogRocket, etc.)
    // this.sendToMonitoring(errorLog);
  }

  /**
   * Log API errors
   */
  logAPIError(
    endpoint: string,
    statusCode: number,
    error: any,
    userMessage?: string,
  ): void {
    this.log(
      `API Error: ${endpoint} (${statusCode})`,
      statusCode >= 500 ? ErrorSeverity.CRITICAL : ErrorSeverity.ERROR,
      {
        endpoint,
        statusCode,
        errorDetails: this.isDevelopment ? error : undefined,
      },
      userMessage || `Failed to fetch ${endpoint}. Please try again.`,
    );
  }

  /**
   * Log rate limit errors
   */
  logRateLimit(remainingRequests: number, resetTime?: number): void {
    this.log(
      "Rate limit exceeded",
      ErrorSeverity.WARNING,
      {
        remainingRequests,
        resetTime,
      },
      "Too many requests. Please wait before trying again.",
    );
  }

  /**
   * Get all logs (for debugging)
   */
  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Send logs to monitoring service
   * TODO: Implement actual service integration
   */
  async sendLogsToMonitoring(): Promise<void> {
    if (this.logs.length === 0) return;

    try {
      // TODO: Send to Sentry, LogRocket, or similar service
      // await fetch('/api/logs', { method: 'POST', body: JSON.stringify(this.logs) });
      console.log("Logs would be sent to monitoring service:", this.logs);
    } catch (error) {
      console.error("Failed to send logs to monitoring:", error);
    }
  }

  /**
   * Console output with proper formatting
   */
  private consoleOutput(log: ErrorLog): void {
    const prefix = `[${log.timestamp}] [${log.severity.toUpperCase()}]`;

    switch (log.severity) {
      case ErrorSeverity.CRITICAL:
        console.error(`🔴 ${prefix} ${log.message}`, log.context);
        break;
      case ErrorSeverity.ERROR:
        console.error(`🔴 ${prefix} ${log.message}`, log.context);
        break;
      case ErrorSeverity.WARNING:
        console.warn(`⚠️ ${prefix} ${log.message}`, log.context);
        break;
      case ErrorSeverity.INFO:
        console.log(`ℹ️ ${prefix} ${log.message}`, log.context);
        break;
    }
  }

  /**
   * Get user-friendly message based on severity
   */
  private getDefaultUserMessage(severity: ErrorSeverity): string {
    const messages: Record<ErrorSeverity, string> = {
      [ErrorSeverity.INFO]: "Information updated",
      [ErrorSeverity.WARNING]: "Something might not work as expected",
      [ErrorSeverity.ERROR]: "An error occurred. Please try again.",
      [ErrorSeverity.CRITICAL]:
        "A critical error occurred. Please refresh the page.",
    };

    return messages[severity];
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

/**
 * Utility function for handling API responses
 */
export async function handleAPIResponse<T>(
  response: Response,
  endpoint: string,
): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    errorLogger.logAPIError(endpoint, response.status, errorData);

    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

/**
 * Utility function for handling async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  userMessage?: string,
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    errorLogger.log(
      `${operationName} failed: ${error instanceof Error ? error.message : String(error)}`,
      ErrorSeverity.ERROR,
      {
        operationName,
        error: error instanceof Error ? error.message : String(error),
      },
      userMessage || `${operationName} failed. Please try again.`,
    );

    return null;
  }
}
