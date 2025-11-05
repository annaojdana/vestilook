import { afterAll, afterEach, beforeAll, vi } from "vitest";

export let server: {
  listen: (options?: { onUnhandledRequest?: "error" | "warn" | "bypass" }) => void;
  resetHandlers: () => void;
  close: () => void;
} | null = null;

const isVitest = typeof process !== "undefined" && Boolean(process.env?.VITEST_WORKER_ID);

if (isVitest) {
  const { setupServer } = await import("msw/node");
  server = setupServer();

  beforeAll(() => {
    if (!("ResizeObserver" in globalThis)) {
      class ResizeObserverMock {
        callback: ResizeObserverCallback;

        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }

        observe() {
          // no-op in test environment
        }

        unobserve() {
          // no-op in test environment
        }

        disconnect() {
          // no-op in test environment
        }
      }

      Object.defineProperty(globalThis, "ResizeObserver", {
        writable: true,
        configurable: true,
        value: ResizeObserverMock,
      });
    }

    server?.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server?.resetHandlers();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server?.close();
  });
} else {
  afterEach(() => {
    vi.restoreAllMocks();
  });
}
