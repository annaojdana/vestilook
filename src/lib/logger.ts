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
    (typeof process !== 'undefined' && typeof process.env !== 'undefined'
      ? process.env.PRIVATE_LOG_LEVEL ?? process.env.LOG_LEVEL
      : undefined);

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

function generateRequestId(): string {
  if (typeof globalThis !== 'undefined') {
    const cryptoApi = globalThis.crypto as Crypto | undefined;
    if (cryptoApi?.randomUUID) {
      return cryptoApi.randomUUID();
    }

    if (cryptoApi?.getRandomValues) {
      const buffer = new Uint8Array(16);
      cryptoApi.getRandomValues(buffer);
      buffer[6] = (buffer[6] & 0x0f) | 0x40;
      buffer[8] = (buffer[8] & 0x3f) | 0x80;
      const hex = [...buffer].map((b) => b.toString(16).padStart(2, '0'));
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
        .slice(8, 10)
        .join('')}-${hex.slice(10).join('')}`;
    }
  }

  return `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

  const withRequest = (requestId = generateRequestId()): Logger => child({ requestId });

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
