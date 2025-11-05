import React from "react";
import type { GenerationHistoryFilters } from "../../../types";

interface EmptyStateProps {
  filters: GenerationHistoryFilters;
}

const EmptyState: React.FC<EmptyStateProps> = ({ filters }) => {
  return (
    <div>
      <h2>Empty State</h2>
      {/* TODO: Implement empty state */}
    </div>
  );
};

export default EmptyState;
