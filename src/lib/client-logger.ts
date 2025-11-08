import type { Logger } from "./logger.ts";
import { createLogger } from "./logger.ts";

const noop = () => {};

const noopLogger: Logger = {
  level: "error",
  context: {},
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  child: () => noopLogger,
  withRequest: () => noopLogger,
};

const isClientLoggingEnabled =
  import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_CLIENT_LOGS === "true";

const baseLogger = isClientLoggingEnabled
  ? createLogger({ name: "vestilook-client" })
  : noopLogger;

export const clientLogger = baseLogger;
