import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface GeneratePrimaryButtonProps {
  disabled: boolean;
  loading: boolean;
  remainingQuota: number;
}

export function GeneratePrimaryButton({ disabled, loading, remainingQuota }: GeneratePrimaryButtonProps) {
  return (
    <Button
      type="submit"
      className="h-12 rounded-lg text-base font-semibold"
      disabled={disabled}
      data-testid="generation-submit-button"
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
      {loading ? "Generowanie trwa..." : "Generuj stylizację"}
      <span className="sr-only">
        Pozostało {remainingQuota} darmowych generacji.
      </span>
    </Button>
  );
}
