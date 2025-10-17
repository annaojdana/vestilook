import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { setupServer } from "msw/node";

export const server = setupServer();

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverMock {
      callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe() {
        // no-op for tests
      }

      unobserve() {
        // no-op for tests
      }

      disconnect() {
        // no-op for tests
      }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      writable: true,
      configurable: true,
      value: ResizeObserverMock,
    });
  }

  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});
