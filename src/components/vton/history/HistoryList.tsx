import type { FC } from "react";

import { Button } from "@/components/ui/button";

import HistoryRow from "./HistoryRow";

import type { GenerationHistoryItemViewModel } from "../../../types";

interface HistoryListProps {
  items: GenerationHistoryItemViewModel[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onOpen: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (item: GenerationHistoryItemViewModel) => void;
  onRate: (id: string, rating: number) => void;
}

const HistoryList: FC<HistoryListProps> = ({
  items,
  isLoading,
  error,
  onRetry,
  onOpen,
  onDownload,
  onDelete,
  onRate,
}) => {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/70 p-6 text-sm text-muted-foreground"
      >
        <strong className="text-base text-foreground">Ładuję historię generacji…</strong>
        <p>Może to potrwać kilka sekund przy większej liczbie stylizacji.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        <div>
          <strong className="text-base">Nie udało się pobrać historii.</strong>
          <p className="text-destructive/80">{error.message}</p>
        </div>
        <div>
          <Button type="button" variant="destructive" onClick={onRetry}>
            Spróbuj ponownie
          </Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
        <p className="text-base font-semibold text-foreground">Brak jeszcze żadnych generacji</p>
        <p className="text-sm text-muted-foreground">
          Gdy wygenerujesz pierwszą stylizację, pojawi się tutaj razem z szybkim podglądem i oceną.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4" role="list">
      {items.map((item) => (
        <HistoryRow
          key={item.id}
          item={item}
          onOpen={onOpen}
          onDownload={onDownload}
          onDelete={onDelete}
          onRate={onRate}
        />
      ))}
    </ul>
  );
};

export default HistoryList;
