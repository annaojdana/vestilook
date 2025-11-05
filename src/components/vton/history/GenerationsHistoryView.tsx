import React from "react";
import type { GenerationHistoryFilters, GenerationSummaryDto } from "../../../types";
import FilterToolbar from "./FilterToolbar";
import HistoryList from "./HistoryList";
import PaginationControls from "./PaginationControls";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import EmptyState from "./EmptyState";

interface GenerationsHistoryViewProps {
  session: any; // TODO: Określ typ sesji
}

const GenerationsHistoryView: React.FC<GenerationsHistoryViewProps> = ({ session }) => {
  const initialFilters: GenerationHistoryFilters = {
    status: [],
    limit: 20,
  };

  const items: GenerationSummaryDto[] = [];

  const handlePageChange = () => {};
  const handleSubmit = () => {};
  const handleChange = () => {};
  const handleConfirm = () => {};
  const handleCancel = () => {};
  const handleRetry = () => {};

  return (
    <section className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Historia Generacji</h1>
      <FilterToolbar value={initialFilters} onChange={handleChange} onSubmit={handleSubmit} isPending={false} />
      <HistoryList items={items} isLoading={false} error={null} onRetry={handleRetry} />
      <PaginationControls
        pageInfo={{ hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null }}
        onPageChange={handlePageChange}
        isPending={false}
      />
      <ConfirmDeleteDialog onConfirm={handleConfirm} isSubmitting={false} onCancel={handleCancel} />
      <EmptyState filters={initialFilters} />
    </section>
  );
};

export default GenerationsHistoryView;
