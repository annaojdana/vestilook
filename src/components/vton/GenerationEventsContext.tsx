import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import type { JSX, PropsWithChildren } from "react";

interface GenerationEventBus {
  emitListRefresh(): void;
  subscribeListRefresh(listener: () => void): () => void;
}

const GenerationEventsContext = createContext<GenerationEventBus | null>(null);

export function GenerationEventsProvider({ children }: PropsWithChildren): JSX.Element {
  const listenersRef = useRef<Set<() => void>>(new Set());

  const emitListRefresh = useCallback(() => {
    listenersRef.current.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("Listener for generation list refresh threw an error.", error);
      }
    });
  }, []);

  const subscribeListRefresh = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo<GenerationEventBus>(
    () => ({
      emitListRefresh,
      subscribeListRefresh,
    }),
    [emitListRefresh, subscribeListRefresh],
  );

  return <GenerationEventsContext.Provider value={value}>{children}</GenerationEventsContext.Provider>;
}

export function useGenerationEvents(): GenerationEventBus {
  const context = useContext(GenerationEventsContext);
  if (!context) {
    throw new Error("useGenerationEvents must be used within GenerationEventsProvider.");
  }

  return context;
}

export function useGenerationListRefresh(): () => void {
  const { emitListRefresh } = useGenerationEvents();
  return emitListRefresh;
}

export function useOnGenerationListRefresh(listener: () => void): void {
  const { subscribeListRefresh } = useGenerationEvents();

  useEffect(() => {
    const unsubscribe = subscribeListRefresh(listener);
    return () => {
      unsubscribe();
    };
  }, [listener, subscribeListRefresh]);
}
