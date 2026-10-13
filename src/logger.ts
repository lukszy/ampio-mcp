import pino from "pino";
import { getConfig, isDevelopment } from "./config.ts";

// Lazy: config (and thus mandatory env) is only read on first log call,
// so importing logger doesn't require env to be set yet.
let _logger: pino.Logger | null = null;

export const logger = new Proxy({} as pino.Logger, {
  get(_target, prop) {
    if (!_logger) {
      const config = getConfig();
      _logger = pino({
        level: config.LOG_LEVEL,

        // Pretty print in development, structured JSON in production
        transport: isDevelopment()
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            }
          : undefined,

        // Base fields for all log entries
        base: {
          service: config.SERVER_NAME,
          version: config.SERVER_VERSION,
          environment: config.NODE_ENV,
        },

        formatters: {
          level: (label) => ({ level: label }),
        },
      });
    }
    const value = Reflect.get(_logger, prop, _logger);
    return typeof value === "function" ? value.bind(_logger) : value;
  },
});
