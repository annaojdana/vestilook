import type { JSX } from "react";

import type { StatusActionIntent, StatusActionPermissions } from "@/lib/vton/status.mapper.ts";
import { Button } from "@/components/ui/button.tsx";
import { Download, Eye, Loader2, LogOut, RefreshCw, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface StatusActionBarProps {
  actions: StatusActionPermissions;
  busy?: boolean;
  onAction(intent: StatusActionIntent): void;
}

export function StatusActionBar({ actions, busy = false, onAction }: StatusActionBarProps): JSX.Element {
  const descriptors = buildActionDescriptors(actions);
  const primary = pickPrimary(descriptors);
  const secondary = descriptors.filter((action) => action.intent !== primary?.intent);

  return (
    <section className="border-b bg-muted/20 px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {primary ? (
            <Button
              key={primary.intent}
              type="button"
              variant={primary.variant}
              size="lg"
              disabled={busy || primary.disabled}
              onClick={() => onAction(primary.intent)}
            >
              {busy && primary.intent === "view-result" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {primary.icon ? <primary.icon className="size-4" aria-hidden="true" /> : null}
              {primary.label}
            </Button>
          ) : null}

          {secondary.map((action) => (
            <Button
              key={action.intent}
              type="button"
              variant={action.variant}
              size="sm"
              disabled={busy || action.disabled}
              onClick={() => onAction(action.intent)}
            >
              {action.icon ? <action.icon className="size-4" aria-hidden="true" /> : null}
              {action.label}
            </Button>
          ))}
        </div>

        {descriptors.length === 0 ? (
          <p className="text-xs text-muted-foreground">Brak dostępnych akcji dla bieżącego statusu.</p>
        ) : null}

        {actions.disabledReason ? (
          <p className="text-xs text-muted-foreground">
            {actions.disabledReason}
          </p>
        ) : null}
      </div>
    </section>
  );
}

interface ActionDescriptor {
  intent: StatusActionIntent;
  label: string;
  variant: "default" | "outline" | "ghost" | "secondary";
  priority: number;
  disabled?: boolean;
  icon?: LucideIcon;
}

function buildActionDescriptors(actions: StatusActionPermissions): ActionDescriptor[] {
  const descriptors: ActionDescriptor[] = [];

  if (actions.canViewResult) {
    descriptors.push({
      intent: "view-result",
      label: "Zobacz wynik",
      variant: "default",
      priority: 1,
      icon: Eye,
      disabled: Boolean(actions.disabledReason) && !actions.canDownload,
    });
  }

  if (actions.canDownload) {
    descriptors.push({
      intent: "download",
      label: "Pobierz plik",
      variant: "outline",
      priority: actions.canViewResult ? 3 : 1,
      icon: Download,
      disabled: Boolean(actions.disabledReason),
    });
  }

  if (actions.canRetry) {
    descriptors.push({
      intent: "retry",
      label: "Spróbuj ponownie",
      variant: "secondary",
      priority: actions.canViewResult ? 4 : 2,
      icon: RefreshCw,
    });
  }

  if (actions.canKeepWorking) {
    descriptors.push({
      intent: "keep-working",
      label: "Kontynuuj w tle",
      variant: "ghost",
      priority: 5,
      icon: LogOut,
    });
  }

  if (actions.canRate) {
    descriptors.push({
      intent: "rate",
      label: "Oceń rezultat",
      variant: "ghost",
      priority: 6,
      icon: Sparkles,
    });
  }

  return descriptors.sort((a, b) => a.priority - b.priority);
}

function pickPrimary(actions: ActionDescriptor[]): ActionDescriptor | null {
  if (actions.length === 0) {
    return null;
  }

  const preferredOrder: StatusActionIntent[] = ["view-result", "retry", "keep-working", "download", "rate"];
  const preferred = preferredOrder
    .map((intent) => actions.find((action) => action.intent === intent))
    .find((action): action is ActionDescriptor => Boolean(action));

  return preferred ?? actions[0];
}
