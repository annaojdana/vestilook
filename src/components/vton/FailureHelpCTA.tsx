import type { JSX } from "react";

import type { FailureActionIntent, FailureContext } from "@/lib/vton/status-messages.ts";
import { Button } from "@/components/ui/button.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { AlertCircle, LifeBuoy, RefreshCcw, UploadCloud } from "lucide-react";

export interface FailureHelpCTAProps {
  context: FailureContext;
  onAction?(intent: FailureActionIntent): void;
}

const actionDescriptors: Record<FailureActionIntent, { label: string; icon: typeof RefreshCcw; variant: "default" | "outline" | "secondary" | "ghost" }> = {
  retry: { label: "Spróbuj ponownie", icon: RefreshCcw, variant: "default" },
  "contact-support": { label: "Kontakt z zespołem", icon: LifeBuoy, variant: "secondary" },
  "view-logs": { label: "Zobacz logi", icon: AlertCircle, variant: "ghost" },
  "reupload-garment": { label: "Prześlij nowy plik", icon: UploadCloud, variant: "outline" },
};

export function FailureHelpCTA({ context, onAction }: FailureHelpCTAProps): JSX.Element {
  const actions = context.actions ?? [];

  return (
    <Alert variant="destructive">
      <AlertTitle className="flex items-center gap-2">{context.title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{context.description}</p>
        {context.hint ? <p className="text-sm text-destructive/80">{context.hint}</p> : null}

        {actions.length > 0 || context.supportUrl ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {actions.map((intent) => {
              const descriptor = actionDescriptors[intent];
              if (!descriptor) {
                return null;
              }

              const Icon = descriptor.icon;

              return (
                <Button
                  key={intent}
                  type="button"
                  variant={descriptor.variant}
                  size="sm"
                  onClick={() => onAction?.(intent)}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {descriptor.label}
                </Button>
              );
            })}

            {context.supportUrl ? (
              <Button asChild variant="secondary" size="sm">
                <a href={context.supportUrl} target="_blank" rel="noreferrer">
                  <LifeBuoy className="size-4" aria-hidden="true" />
                  Otwórz pomoc
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
