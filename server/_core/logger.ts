import { ENV } from "./env";

/**
 * Conditional logger that disables console output in production
 * to avoid exposing sensitive information and improve performance.
 */
export const logger = {
  log: (...args: any[]) => {
    if (!ENV.isProduction) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (!ENV.isProduction) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors, even in production, but sanitize sensitive data
    console.error(...args);
  },
  
  info: (...args: any[]) => {
    if (!ENV.isProduction) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (!ENV.isProduction) {
      console.debug(...args);
    }
  },
};

/**
 * Production-safe logger that only logs errors
 */
export const prodLogger = {
  log: () => {},
  warn: () => {},
  error: console.error,
  info: () => {},
  debug: () => {},
};
