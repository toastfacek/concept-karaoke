type LogLevel = "debug" | "info" | "warn" | "error"

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info"
const threshold = LOG_LEVELS[configuredLevel] ?? LOG_LEVELS.info

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < threshold) {
    return
  }
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...(context ?? {}),
  }
  console.log(JSON.stringify(entry))
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    log("debug", message, context)
  },
  info(message: string, context?: Record<string, unknown>) {
    log("info", message, context)
  },
  warn(message: string, context?: Record<string, unknown>) {
    log("warn", message, context)
  },
  error(message: string, context?: Record<string, unknown>) {
    log("error", message, context)
  },
}

