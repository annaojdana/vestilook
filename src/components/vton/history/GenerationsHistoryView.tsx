import { useMemo, useState } from "react";

import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import EmptyState from "./EmptyState";
import FilterToolbar from "./FilterToolbar";
import HistoryList from "./HistoryList";
import PaginationControls from "./PaginationControls";
import useGenerationHistory from "./hooks/useGenerationHistory";

import type { GenerationHistoryFilters, GenerationHistoryItemViewModel } from "../../../types";

interface GenerationsHistoryViewProps {
  session: { access_token: string } | null;
}

const DEFAULT_FILTERS: GenerationHistoryFilters = {
  status: [],
  limit: 20,
};

const GenerationsHistoryView: React.FC<GenerationsHistoryViewProps> = ({ session }) => {
  const [draftFilters, setDraftFilters] = useState<GenerationHistoryFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<GenerationHistoryFilters>(DEFAULT_FILTERS);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorBackStack, setCursorBackStack] = useState<(string | null)[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingDeletion, setPendingDeletion] = useState<GenerationHistoryItemViewModel | undefined>(undefined);

  const { items, nextCursor, isLoading, error, refresh } = useGenerationHistory({
    filters: appliedFilters,
    cursor,
    sessionToken: session?.access_token,
  });

  const pageInfo = useMemo(
    () => ({
      hasNextPage: Boolean(nextCursor),
      hasPreviousPage: cursorBackStack.length > 0,
      startCursor: items[0]?.id ?? null,
      endCursor: items[items.length - 1]?.id ?? null,
    }),
    [cursorBackStack.length, items, nextCursor],
  );

  const handleFilterChange = (value: GenerationHistoryFilters) => {
    setDraftFilters(value);
  };

  const resetPagination = () => {
    setCursor(null);
    setCursorBackStack([]);
    setCurrentPage(1);
  };

  const handleFilterSubmit = () => {
    setAppliedFilters(draftFilters);
    resetPagination();
  };

  const handleRetry = () => {
    refresh();
  };

  const handleOpen = (_id: string) => {};
  const handleDownload = (_id: string) => {};
  const handleRate = (_id: string, _rating: number) => {};
  const handleDelete = (item: GenerationHistoryItemViewModel) => setPendingDeletion(item);

  const handlePageChange = (direction: "next" | "previous") => {
    if (direction === "next") {
      if (!nextCursor) {
        return;
      }
      setCursorBackStack((stack) => [...stack, cursor]);
      setCursor(nextCursor);
      setCurrentPage((page) => page + 1);
      return;
    }

    setCursorBackStack((stack) => {
      if (stack.length === 0) {
        return stack;
      }
      const updated = [...stack];
      const previousCursor = updated.pop() ?? null;
      setCursor(previousCursor);
      setCurrentPage((page) => Math.max(1, page - 1));
      return updated;
    });
  };

  const closeDeleteDialog = () => setPendingDeletion(undefined);

  const showEmptyState = !isLoading && items.length === 0 && !error;

  return (
    <section className="container mx-auto py-8">
      <div className="mb-6 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">Historia</p>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Twoje generacje</h1>
      </div>

      <FilterToolbar value={draftFilters} onChange={handleFilterChange} onSubmit={handleFilterSubmit} isPending={isLoading} />

      {showEmptyState ? (
        <EmptyState filters={appliedFilters} />
      ) : (
        <HistoryList
          items={items}
          isLoading={isLoading}
          error={error}
          onRetry={handleRetry}
          onOpen={handleOpen}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onRate={handleRate}
        />
      )}

      <PaginationControls
        pageInfo={pageInfo}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        isPending={isLoading}
      />

      <ConfirmDeleteDialog
        target={pendingDeletion}
        onConfirm={() => {
          closeDeleteDialog();
        }}
        onCancel={closeDeleteDialog}
        isSubmitting={false}
      />
    </section>
  );
};

export default GenerationsHistoryView;
