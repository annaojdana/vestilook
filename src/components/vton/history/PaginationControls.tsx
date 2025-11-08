import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { FC } from "react";

import { Button } from "@/components/ui/button";

interface PaginationState {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

interface PaginationControlsProps {
  pageInfo: PaginationState;
  currentPage: number;
  onPageChange: (direction: "next" | "previous") => void;
  isPending: boolean;
}

const PaginationControls: FC<PaginationControlsProps> = ({ pageInfo, currentPage, onPageChange, isPending }) => {
  const disablePrev = !pageInfo.hasPreviousPage || isPending;
  const disableNext = !pageInfo.hasNextPage || isPending;

  return (
    <nav
      className="mt-6 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      aria-label="Nawigacja historii"
    >
      <div aria-live="polite">
        Strona {currentPage}
        {pageInfo.startCursor ? ` • od ${pageInfo.startCursor.slice(0, 8)}…` : null}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onPageChange("previous")}
          disabled={disablePrev}
          aria-label="Poprzednia strona"
        >
          <ChevronLeftIcon className="mr-2 size-4" aria-hidden="true" />
          Wstecz
        </Button>
        <Button
          type="button"
          onClick={() => onPageChange("next")}
          disabled={disableNext}
          aria-label="Następna strona"
        >
          Dalej
          <ChevronRightIcon className="ml-2 size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
};

export default PaginationControls;
