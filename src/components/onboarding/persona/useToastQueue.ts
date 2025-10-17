import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

import type { ToastPayload, ToastVariant } from "@/types.ts";

type ToastRecord = ToastPayload & { id: string };

interface ToastQueue {
  present: (payload: ToastPayload) => string;
  update: (id: string, patch: Partial<ToastPayload>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export function useToastQueue(): ToastQueue {
  const registry = useRef<Map<string, ToastRecord>>(new Map());

  const renderToast = useCallback((payload: ToastRecord) => {
    const options = {
      id: payload.id,
      description: payload.description,
      duration: payload.variant === "progress" ? Infinity : payload.durationMs,
      dismissible: payload.dismissible ?? true,
      action: payload.action
        ? {
            label: payload.action.label,
            onClick: payload.action.onSelect,
          }
        : undefined,
    } as const;

    invokeToast(payload.variant, payload.title, options);
  }, []);

  const present = useCallback(
    (payload: ToastPayload) => {
      const id = payload.id ?? crypto.randomUUID();
      const record: ToastRecord = {
        ...payload,
        id,
      };

      registry.current.set(id, record);
      renderToast(record);

      return id;
    },
    [renderToast]
  );

  const update = useCallback(
    (id: string, patch: Partial<ToastPayload>) => {
      const current = registry.current.get(id);
      if (!current) {
        return;
      }

      const nextRecord: ToastRecord = {
        ...current,
        ...patch,
        id,
      };

      registry.current.set(id, nextRecord);
      renderToast(nextRecord);
    },
    [renderToast]
  );

  const dismiss = useCallback((id: string) => {
    registry.current.delete(id);
    toast.dismiss(id);
  }, []);

  const clear = useCallback(() => {
    for (const id of registry.current.keys()) {
      toast.dismiss(id);
    }

    registry.current.clear();
  }, []);

  return useMemo(
    () => ({
      present,
      update,
      dismiss,
      clear,
    }),
    [clear, dismiss, present, update]
  );
}

function invokeToast(variant: ToastVariant, title: string, options: Parameters<typeof toast>[1]) {
  switch (variant) {
    case "success":
      toast.success(title, options);
      return;
    case "warning":
      toast.warning(title, options);
      return;
    case "error":
      toast.error(title, options);
      return;
    case "progress":
      toast.loading(title, options);
      return;
    case "info":
    case "default":
    default:
      toast(title, options);
  }
}
