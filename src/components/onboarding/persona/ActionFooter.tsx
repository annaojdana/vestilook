import { ArrowRightIcon, LifeBuoyIcon } from "lucide-react";
import type { FC, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionFooterProps {
  disabled: boolean;
  onContinue: () => void;
  supportLink?: string;
  supportLabel?: string;
  meta?: ReactNode;
  className?: string;
}

const ActionFooter: FC<ActionFooterProps> = ({
  disabled,
  onContinue,
  supportLink,
  supportLabel = "Skontaktuj się z zespołem Vestilook",
  meta,
  className,
}) => {
  return (
    <footer
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/80 p-4 shadow-[0_-12px_35px_-24px_rgb(15_23_42/0.35)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {meta ?? (
          <>
            <span>Po przesłaniu persony przejdziesz do konfiguracji ubrań.</span>
            <span className="text-muted-foreground/70">Możesz wrócić do tego kroku w dowolnej chwili.</span>
          </>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {supportLink ? (
          <a
            href={supportLink}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <LifeBuoyIcon className="size-4" aria-hidden="true" />
            {supportLabel}
          </a>
        ) : null}
        <Button type="button" onClick={onContinue} disabled={disabled} className="min-w-[11rem]">
          Przejdź dalej
          <ArrowRightIcon className="ml-2 size-4" aria-hidden="true" />
        </Button>
      </div>
    </footer>
  );
};

export default ActionFooter;
