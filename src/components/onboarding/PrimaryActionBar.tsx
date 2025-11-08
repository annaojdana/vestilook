import type { FC, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionDescriptor {
  label: string;
  onClick(): void;
}

interface PrimaryActionBarProps {
  primary: ActionDescriptor;
  secondary?: ActionDescriptor;
  disabled?: boolean;
  loading?: boolean;
  meta?: ReactNode;
  className?: string;
}

const PrimaryActionBar: FC<PrimaryActionBarProps> = ({
  primary,
  secondary,
  disabled = false,
  loading = false,
  meta,
  className,
}) => {
  return (
    <footer
      className={cn(
        "sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border/60 bg-card/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_32px_-18px_rgb(30_41_59/0.65)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:pb-4",
        className
      )}
    >
      <div className="text-xs text-muted-foreground">{meta}</div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {secondary ? (
          <Button variant="outline" type="button" onClick={secondary.onClick} disabled={disabled || loading}>
            {secondary.label}
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={primary.onClick}
          disabled={disabled || loading}
          aria-busy={loading}
          className="min-h-11 min-w-[9rem]"
        >
          {loading ? "Zapisywanie..." : primary.label}
        </Button>
      </div>
    </footer>
  );
};

export default PrimaryActionBar;
