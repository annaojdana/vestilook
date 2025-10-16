import { randomUUID } from 'node:crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerContext {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug: (message: string, context?: LoggerContext) => void;
  info: (message: string, context?: LoggerContext) => void;
  warn: (message: string, context?: LoggerContext) => void;
  error: (message: string, context?: LoggerContext) => void;
  child: (context: LoggerContext) => Logger;
  withRequest: (requestId?: string) => Logger;
  level: LogLevel;
  context: LoggerContext;
}

interface LoggerOptions {
  name?: string;
  level?: LogLevel;
  context?: LoggerContext;
  destination?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && value in LEVEL_PRIORITY;
}

function resolveLevel(level?: LogLevel): LogLevel {
  const envLevel =
    (typeof import.meta !== 'undefined' &&
    typeof import.meta.env !== 'undefined' &&
    typeof import.meta.env.PRIVATE_LOG_LEVEL === 'string'
      ? import.meta.env.PRIVATE_LOG_LEVEL
      : undefined) ??
    process.env.PRIVATE_LOG_LEVEL ??
    process.env.LOG_LEVEL;

  const candidate = level ?? envLevel ?? 'info';
  return isLogLevel(candidate) ? candidate : 'info';
}

function shouldLog(current: LogLevel, target: LogLevel): boolean {
  return LEVEL_PRIORITY[target] >= LEVEL_PRIORITY[current];
}

function mergeContext(base: LoggerContext, next?: LoggerContext): LoggerContext {
  if (!next) {
    return base;
  }

  return { ...base, ...next };
}

function serializeContext(context: LoggerContext): Record<string, unknown> {
  return Object.entries(context).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined) {
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});
}

function write(
  destination: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>,
  level: LogLevel,
  name: string | undefined,
  message: string,
  context: LoggerContext,
) {
  const payload = serializeContext(context);
  const prefix = name ? `[${name}]` : '';
  destination[level](prefix ? `${prefix} ${message}` : message, payload);
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const { name, destination = console } = options;
  const level = resolveLevel(options.level);
  const baseContext: LoggerContext = { ...options.context };

  const withLevel =
    (target: LogLevel) =>
    (message: string, context?: LoggerContext) => {
      if (!shouldLog(level, target)) {
        return;
      }

      const merged = mergeContext(baseContext, context);
      write(destination, target, name, message, merged);
    };

  const child = (context: LoggerContext): Logger =>
    createLogger({
      name,
      level,
      destination,
      context: mergeContext(baseContext, context),
    });

  const withRequest = (requestId = randomUUID()): Logger => child({ requestId });

  return {
    level,
    context: baseContext,
    debug: withLevel('debug'),
    info: withLevel('info'),
    warn: withLevel('warn'),
    error: withLevel('error'),
    child,
    withRequest,
  };
}

export const defaultLogger = createLogger({ name: 'vestilook' });
